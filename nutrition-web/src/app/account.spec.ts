import { Component } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router, UrlTree } from '@angular/router';
import { AuthPage } from './auth/auth-page';
import { authenticated, protectedApi, Session, sessionInterceptor } from './auth/session';
import { PatientForm } from './patients/patient-form';
import { PatientList } from './patients/patient-list';
import { Patient, PatientPage } from './patients/patients-api';
import { NutritionistLayout } from './layout/nutritionist-layout';
import { ProfilePage } from './profile/profile-page';
import { PlanningReuseStrategy } from './planning-reuse';

@Component({ template: '' }) class Blank {}

// Fictitious data only.
const nutritionist = { id: 'nutri-ficticio', name: 'Nutricionista Fictício', email: 'ficticio@example.com' };
const authResponse = { accessToken: 'test-only-token', tokenType: 'Bearer', expiresAt: '2026-09-18T00:00:00Z', nutritionist };
const patient: Patient = {
  id: 'patient-ficticio', name: 'Paciente Fictício', birthDate: '2010-12-25', ageYears: 15, sex: 'FEMALE',
  phone: null, email: null, notes: null, weightKg: 50, heightCm: 160, driActivity: 'LOW_ACTIVE',
  measuredAt: '2026-09-17', version: 3, archived: false, createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z',
};
const page: PatientPage = { content: [patient], page: 0, size: 20, totalElements: 21, totalPages: 2 };

describe('Login e pacientes independentes do planejamento', () => {
  let routeState: { snapshot: { data: { registering: boolean }; paramMap: ReturnType<typeof convertToParamMap> } };
  let http: HttpTestingController;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    routeState = { snapshot: { data: { registering: false }, paramMap: convertToParamMap({}) } };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: Blank }, { path: 'pacientes', component: Blank }]),
        { provide: ActivatedRoute, useValue: routeState },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.useRealTimers();
      TestBed.resetTestingModule();
      sessionStorage.clear();
    }
  });

  function route(registering = false, id: string | null = null) {
    routeState.snapshot = { data: { registering }, paramMap: convertToParamMap(id ? { id } : {}) };
  }

  function login() {
    TestBed.inject(Session).authenticate('login', { email: 'ficticio@example.com', password: 'senha-ficticia' }).subscribe();
    http.expectOne('/api/auth/login').flush(authResponse);
  }

  function submit(element: HTMLElement) {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function openForm(id: string | null = null) {
    route(false, id);
    return TestBed.createComponent(PatientForm);
  }

  for (const registering of [false, true]) {
    const action = registering ? 'cadastro' : 'login';
    const endpoint = `/api/auth/${registering ? 'register' : 'login'}`;

    it(`${action} guarda token na sessão e navega`, () => {
      route(registering);
      const fixture = TestBed.createComponent(AuthPage);
      fixture.detectChanges();
      fixture.componentInstance.form.setValue({ name: 'Nutricionista Fictício', email: 'ficticio@example.com', password: 'senha-ficticia' });
      submit(fixture.nativeElement);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);

      const request = http.expectOne(endpoint);
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.body.name).toBe(registering ? 'Nutricionista Fictício' : undefined);
      request.flush(authResponse);
      fixture.detectChanges();

      expect(TestBed.inject(Session).token()).toBe(authResponse.accessToken);
      expect(sessionStorage.getItem('nutrition.accessToken')).toBe(authResponse.accessToken);
      expect(localStorage.getItem('nutrition.accessToken')).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/pacientes');
      expect(fixture.componentInstance.form.controls.password.value).toBe('');
    });

    it(`${action} mostra mensagem e erros da API`, () => {
      route(registering);
      const fixture = TestBed.createComponent(AuthPage);
      fixture.detectChanges();
      fixture.componentInstance.form.patchValue({ email: 'ficticio@example.com', password: 'senha-ficticia' });
      fixture.componentInstance.submit();

      http.expectOne(endpoint).flush(
        { detail: 'Falha fictícia.', errors: [{ field: 'email', message: 'E-mail já cadastrado.' }] },
        { status: registering ? 409 : 401, statusText: 'Error' },
      );
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Falha fictícia.');
      expect(fixture.nativeElement.textContent).toContain('E-mail já cadastrado.');
      expect(navigate).not.toHaveBeenCalled();
      expect(TestBed.inject(Session).token()).toBeNull();
    });
  }

  it('restaura token do sessionStorage e remove a sessão ao sair', () => {
    sessionStorage.setItem('nutrition.accessToken', 'test-session');
    const session = TestBed.inject(Session);
    expect(session.token()).toBe('test-session');

    session.logout();
    expect(session.token()).toBeNull();
    expect(sessionStorage.getItem('nutrition.accessToken')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('guard bloqueia sem sessão e permite com token', () => {
    const canActivate = () => TestBed.runInInjectionContext(() => authenticated({} as never, {} as never));
    expect(router.serializeUrl(canActivate() as UrlTree)).toBe('/login');

    login();
    expect(canActivate()).toBe(true);
  });

  it('interceptor envia token apenas para os caminhos protegidos da própria API', () => {
    login();
    const client = TestBed.inject(HttpClient);
    const protectedUrls = ['/api/auth/me', '/api/patients', '/api/patients/id/archive', '/api/patients?page=1',
      '/api/record-fields', '/api/record-templates', '/api/record-templates/id/default'];
    const publicUrls = ['/api/foods', '/api/energy-estimates', '/api/energy-prescriptions/per-kg', '/api/target-calculations',
      '/api/diet-calculations', 'https://outside.example/api/patients', '/api/patients-other', '/api/auth/login', '/api/record-fieldsx'];

    for (const url of [...protectedUrls, ...publicUrls]) {
      client.get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe(protectedUrls.includes(url) ? 'Bearer test-only-token' : null);
      request.flush({});
    }
    expect(protectedApi('https://outside.example/api/patients')).toBe(false);
  });

  it('401 protegido limpa token e perfil e redireciona', () => {
    login();
    const session = TestBed.inject(Session);
    session.loadProfile().subscribe({ error: () => {} });
    http.expectOne('/api/auth/me').flush({ detail: 'Sessão expirada.' }, { status: 401, statusText: 'Unauthorized' });

    expect(session.token()).toBeNull();
    expect(session.nutritionist()).toBeNull();
    expect(sessionStorage.getItem('nutrition.accessToken')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('barra lateral mostra Perfil, Pacientes, Prontuário e Planejamento, carrega o nome e oferece sair', () => {
    sessionStorage.setItem('nutrition.accessToken', 'test-session');
    const fixture = TestBed.createComponent(NutritionistLayout);
    fixture.detectChanges();
    http.expectOne('/api/auth/me').flush(nutritionist);
    fixture.detectChanges();
    const sidebar: HTMLElement = fixture.nativeElement.querySelector('.sidebar');
    const links = Array.from(sidebar.querySelectorAll('.sidebar-links a')).map(link => [link.textContent!.trim(), link.getAttribute('href')]);
    expect(links).toEqual([['Perfil', '/perfil'], ['Pacientes', '/pacientes'], ['Prontuário', '/prontuario'], ['Planejamento alimentar', '/planejamento']]);
    expect(sidebar.textContent).toContain(nutritionist.name);

    (sidebar.querySelector('.sidebar-logout') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('sem sessão a barra lateral não aparece (planejamento continua público)', () => {
    const fixture = TestBed.createComponent(NutritionistLayout);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-frame').classList).not.toContain('with-sidebar');
  });

  it('perfil mostra os dados da conta do nutricionista', () => {
    login();
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(nutritionist.name);
    expect(fixture.nativeElement.textContent).toContain(nutritionist.email);
  });

  it('mantém o planejamento ao navegar entre telas, mas descarta o de outra sessão', () => {
    login();
    const strategy = TestBed.runInInjectionContext(() => new PlanningReuseStrategy());
    const planning = { routeConfig: { path: 'planejamento' } } as never;
    const patients = { routeConfig: { path: 'pacientes' } } as never;
    const destroy = vi.fn();
    const handle = { componentRef: { destroy } } as never;
    expect(strategy.shouldDetach(planning)).toBe(true);
    expect(strategy.shouldDetach(patients)).toBe(false);

    strategy.store(planning, handle);
    expect(strategy.shouldAttach(planning)).toBe(true);
    expect(strategy.retrieve(planning)).toBe(handle);
    expect(strategy.retrieve(patients)).toBeNull();

    TestBed.inject(Session).logout();
    expect(strategy.shouldAttach(planning)).toBe(false);
    expect(destroy).toHaveBeenCalled();
    expect(strategy.retrieve(planning)).toBeNull();
  });

  it('lista consulta a cada letra com debounce, filtra arquivados e pagina', () => {
    vi.useFakeTimers();
    const isList = (request: { url: string }) => request.url === '/api/patients';
    const fixture = TestBed.createComponent(PatientList);
    fixture.detectChanges();

    const initial = http.expectOne(isList);
    expect(initial.request.params.get('archived')).toBe('false');
    initial.flush(page);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Paciente Fictício');

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'j';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(100);
    input.value = 'jo';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(249);
    http.expectNone(isList);
    vi.advanceTimersByTime(1);
    const search = http.expectOne(isList);
    expect(search.request.params.get('name')).toBe('jo');
    expect(search.request.params.get('page')).toBe('0');
    search.flush(page);

    fixture.componentInstance.goTo(1);
    const next = http.expectOne(isList);
    expect(next.request.params.get('page')).toBe('1');
    next.flush({ ...page, page: 1 });

    fixture.componentInstance.setArchived(true);
    const archived = http.expectOne(isList);
    expect(archived.request.params.get('archived')).toBe('true');
    expect(archived.request.params.get('page')).toBe('0');
    archived.flush({ ...page, content: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum paciente encontrado.');
    fixture.destroy();
  });

  it('lista cancela resposta antiga e não exibe dados fora do filtro atual', () => {
    const fixture = TestBed.createComponent(PatientList);
    fixture.detectChanges();
    const old = http.expectOne(request => request.url === '/api/patients');

    fixture.componentInstance.setArchived(true);
    expect(old.cancelled).toBe(true);
    http.expectOne(request => request.url === '/api/patients').flush({ ...page, content: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(patient.name);
  });

  it('criação envia apenas ao salvar e abre o paciente criado', () => {
    const fixture = openForm();
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ name: 'Paciente Fictício', weightKg: 50 });
    http.expectNone(request => request.url.startsWith('/api/patients'));

    submit(fixture.nativeElement);
    const request = http.expectOne('/api/patients');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.version).toBeUndefined();
    expect(request.request.body.birthDate).toBeNull();
    request.flush(patient);
    expect(navigate).toHaveBeenCalledWith('/pacientes/' + patient.id);
  });

  it('edição envia versão recebida, sem cálculos no frontend', () => {
    const fixture = openForm(patient.id);
    http.expectOne('/api/patients/' + patient.id).flush(patient);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.weightKg.setValue(60);
    http.expectNone(request => request.url.startsWith('/api/patients'));

    fixture.componentInstance.save();
    const request = http.expectOne('/api/patients/' + patient.id);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.version).toBe(3);
    expect(request.request.body.weightKg).toBe(60);
    expect(request.request.body.ageYears).toBeUndefined();
    request.flush({ ...patient, weightKg: 60, version: 4 });
    expect(fixture.componentInstance.patient()?.version).toBe(4);
  });

  it('erros por campo aparecem junto dos dados', () => {
    const fixture = openForm();
    fixture.detectChanges();
    fixture.componentInstance.save();
    http.expectOne('/api/patients').flush(
      { detail: 'Há campos inválidos.', errors: [{ field: 'name', message: 'Informe o nome.' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain('Informe o nome.');
  });

  it('409 bloqueia novo envio até recarregar e usar a versão atual', () => {
    const url = '/api/patients/' + patient.id;
    const fixture = openForm(patient.id);
    http.expectOne(url).flush(patient);
    fixture.componentInstance.save();
    http.expectOne(url).flush({ detail: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('O paciente foi alterado em outra sessão. Recarregue.');

    fixture.componentInstance.save();
    http.expectNone(url);

    fixture.componentInstance.load();
    http.expectOne(url).flush({ ...patient, version: 8 });
    fixture.componentInstance.save();
    const request = http.expectOne(url);
    expect(request.request.body.version).toBe(8);
    request.flush({ ...patient, version: 9 });
  });

  for (const archived of [false, true]) {
    it(`${archived ? 'reativar' : 'arquivar'} exige confirmação e atualiza a tela`, () => {
      const fixture = openForm(patient.id);
      http.expectOne('/api/patients/' + patient.id).flush({ ...patient, archived });
      fixture.detectChanges();

      fixture.componentInstance.changeArchive();
      http.expectNone(request => request.method === 'POST');

      const label = archived ? 'Reativar paciente' : 'Arquivar paciente';
      const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
      buttons.find(button => button.textContent!.includes(label))!.click();
      fixture.detectChanges();
      http.expectNone(request => request.method === 'POST');

      (fixture.nativeElement.querySelector('.confirm button') as HTMLButtonElement).click();
      http.expectOne(`/api/patients/${patient.id}/${archived ? 'unarchive' : 'archive'}`)
        .flush({ ...patient, archived: !archived, version: 4 });
      fixture.detectChanges();
      expect(fixture.componentInstance.patient()?.archived).toBe(!archived);
      expect(fixture.nativeElement.querySelector('.confirm')).toBeNull();
    });
  }
});
