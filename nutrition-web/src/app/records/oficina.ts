import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { apiErrors, ApiErrors, NO_ERRORS } from '../api-errors';
import { FieldPreview } from './field-preview';
import { FieldType, FieldWidth, RecordField, RecordFieldCategory, RecordsApi, RecordTemplate, TemplateField } from './records-api';

interface EditSection { key: number; name: string; fields: TemplateField[] }
interface CatalogEntry { field: RecordField; category: string }
interface Menu { key: number | string; x: number; y: number }

const MAX_SECTIONS = 20;
const MAX_NAME = 60;
const TYPE_LABELS: Record<FieldType, string> = {
  SHORT_TEXT: 'Texto curto', LONG_TEXT: 'Texto longo', NUMBER: 'Número', DATE: 'Data', YES_NO_DETAIL: 'Sim/não com detalhe',
  SINGLE_CHOICE: 'Escolha única', MULTI_CHOICE: 'Múltipla escolha', SCALE: 'Escala', TABLE: 'Tabela',
};
const TYPE_ICONS: Record<FieldType, string> = {
  SHORT_TEXT: 'Aa', LONG_TEXT: '¶', NUMBER: '#', DATE: '▦', YES_NO_DETAIL: '✓',
  SINGLE_CHOICE: '◉', MULTI_CHOICE: '☰', SCALE: '⋯', TABLE: '⊞',
};
// Wide by nature: text blocks, tables and long option lists start with the whole line.
const FULL_BY_DEFAULT: FieldType[] = ['LONG_TEXT', 'TABLE', 'MULTI_CHOICE'];

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Workshop where the nutritionist builds a record template: the toolbox of catalog questions on the left, the
 * sheet with sections as tabs in the middle and the selected field's properties on the right. Everything is
 * edited locally and sent only on "Salvar" (the whole structure); business rules are checked by the backend.
 */
@Component({
  selector: 'app-oficina',
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, FieldPreview, RouterLink],
  templateUrl: './oficina.html',
  styleUrl: './oficina.css',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class Oficina implements OnInit {
  private readonly api = inject(RecordsApi);
  private readonly route = inject(ActivatedRoute);
  private nextKey = 0;
  private id = '';

  readonly widths: { value: FieldWidth; label: string }[] = [
    { value: 'THIRD', label: '1/3' }, { value: 'HALF', label: '1/2' }, { value: 'TWO_THIRDS', label: '2/3' }, { value: 'FULL', label: 'Inteira' }];
  readonly textRows = [3, 5, 8];
  readonly maxSections = MAX_SECTIONS;
  readonly maxName = MAX_NAME;

  readonly categories = signal<RecordFieldCategory[]>([]);
  readonly loaded = signal(false);
  readonly loadError = signal('');
  readonly name = signal('');
  readonly isDefault = signal(false);
  readonly version = signal(0);
  readonly sections = signal<EditSection[]>([]);
  readonly activeSectionKey = signal<number | null>(null);
  readonly selectedCode = signal<string | null>(null);
  private readonly saved = signal('');
  readonly saving = signal(false);
  readonly saveErrors = signal<ApiErrors>(NO_ERRORS);
  readonly conflict = signal(false);
  readonly errorCode = signal<string | null>(null);
  readonly preview = signal(false);
  readonly search = signal('');
  readonly openCategories = signal<ReadonlySet<string>>(new Set());
  readonly editingName = signal(false);
  readonly editingSectionKey = signal<number | null>(null);
  readonly sectionMenu = signal<Menu | null>(null);
  readonly fieldMenu = signal<Menu | null>(null);
  readonly pendingSectionRemoval = signal<number | null>(null);
  readonly announcement = signal('');

  readonly entries = computed(() => {
    const entries = new Map<string, CatalogEntry>();
    for (const category of this.categories()) for (const field of category.fields) entries.set(field.code, { field, category: category.name });
    return entries;
  });
  readonly usedCodes = computed(() => new Set(this.sections().flatMap(section => section.fields.map(field => field.code))));
  readonly fieldCount = computed(() => this.usedCodes().size);
  readonly activeSection = computed(() => this.sections().find(section => section.key === this.activeSectionKey()) ?? this.sections()[0]);
  readonly activeIndex = computed(() => Math.max(this.sections().findIndex(section => section.key === this.activeSectionKey()), 0));
  readonly dirty = computed(() => this.loaded() && this.snapshot() !== this.saved());
  readonly errorMessages = computed(() => Object.values(this.saveErrors().fields));
  /** Search by words, without accents or case, over the label and the help. */
  readonly toolbox = computed(() => {
    const words = normalize(this.search()).split(/\s+/).filter(Boolean);
    if (!words.length) return this.categories();
    return this.categories()
      .map(category => ({ ...category, fields: category.fields.filter(field => {
        const text = normalize(field.label + ' ' + (field.help ?? ''));
        return words.every(word => text.includes(word));
      }) }))
      .filter(category => category.fields.length);
  });
  readonly selected = computed(() => {
    const code = this.selectedCode();
    const section = this.sections().find(item => item.fields.some(field => field.code === code));
    const placement = section?.fields.find(field => field.code === code);
    return section && placement && code ? { code, section, placement, entry: this.entry(code) } : null;
  });

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load() {
    this.loadError.set('');
    forkJoin({ catalog: this.api.fields(), template: this.api.get(this.id) }).subscribe({
      next: ({ catalog, template }) => {
        this.categories.set(catalog.categories);
        this.openCategories.set(new Set(catalog.categories.slice(0, 1).map(category => category.code)));
        this.apply(template);
      },
      error: (error: HttpErrorResponse) => this.loadError.set(apiErrors(error).detail),
    });
  }

  /** After a 409: discards the local edits and loads the saved template again. */
  reload() {
    this.conflict.set(false);
    this.saveErrors.set(NO_ERRORS);
    this.api.get(this.id).subscribe({
      next: template => this.apply(template),
      error: (error: HttpErrorResponse) => this.saveErrors.set(apiErrors(error)),
    });
  }

  private apply(template: RecordTemplate, keepPosition = false) {
    const activeIndex = this.activeIndex();
    this.name.set(template.name);
    this.isDefault.set(template.isDefault);
    this.version.set(template.version);
    this.sections.set(template.sections.map(section => ({ key: this.nextKey++, name: section.name, fields: section.fields.map(field => ({ ...field })) })));
    const sections = this.sections();
    this.activeSectionKey.set(sections[keepPosition ? Math.min(activeIndex, sections.length - 1) : 0].key);
    if (!keepPosition) this.selectedCode.set(null);
    this.saved.set(this.snapshot());
    this.loaded.set(true);
  }

  private snapshot() {
    return JSON.stringify({ name: this.name(), sections: this.sections().map(({ name, fields }) => ({ name, fields })) });
  }

  entry(code: string): CatalogEntry {
    // A field retired from the catalog stays valid in templates that already had it.
    return this.entries().get(code) ?? { field: { code, label: `Campo fora de uso (${code})`, type: 'SHORT_TEXT' }, category: 'Fora de uso' };
  }

  typeLabel(type: FieldType) { return TYPE_LABELS[type]; }
  typeIcon(type: FieldType) { return TYPE_ICONS[type]; }

  save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveErrors.set(NO_ERRORS);
    this.errorCode.set(null);
    this.conflict.set(false);
    const sections = this.sections().map(({ name, fields }) => ({ name, fields }));
    this.api.save(this.id, this.name(), this.version(), sections).subscribe({
      next: template => {
        this.saving.set(false);
        this.apply(template, true);
        this.say('Modelo salvo.');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 409) { this.conflict.set(true); return; }
        const errors = apiErrors(error);
        this.saveErrors.set(errors);
        this.showError(Object.keys(errors.fields)[0]);
      },
    });
  }

  /** Opens the section (and selects the field) named by an error path such as sections[1].fields[2].code. */
  private showError(path: string | undefined) {
    const match = path?.match(/^sections\[(\d+)\](?:\.fields\[(\d+)\])?/);
    const section = match ? this.sections()[Number(match[1])] : undefined;
    if (!section) return;
    this.activeSectionKey.set(section.key);
    const field = match?.[2] === undefined ? undefined : section.fields[Number(match[2])];
    if (field) { this.selectedCode.set(field.code); this.errorCode.set(field.code); }
  }

  makeDefault() {
    this.api.makeDefault(this.id).subscribe({
      // Becoming default bumps the saved version; the local edits stay.
      next: template => { this.isDefault.set(true); this.version.set(template.version); this.say('Modelo definido como padrão.'); },
      error: (error: HttpErrorResponse) => this.saveErrors.set(apiErrors(error)),
    });
  }

  togglePreview() {
    this.closeMenus();
    this.preview.update(value => !value);
  }

  warnBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  // Template name: double click or the pencil edits in place; Enter or leaving saves, Esc cancels, blank restores.
  startNameEdit() {
    this.editingName.set(true);
    this.focus('template-name-input', true);
  }

  commitName(value: string) {
    if (!this.editingName()) return;
    this.editingName.set(false);
    const trimmed = value.trim().slice(0, MAX_NAME);
    if (trimmed) this.name.set(trimmed);
  }

  cancelNameEdit() {
    this.editingName.set(false);
  }

  // Toolbox
  isOpen(code: string) { return !!this.search().trim() || this.openCategories().has(code); }

  toggleCategory(code: string) {
    this.openCategories.update(open => {
      const next = new Set(open);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  /** Toolbox lists only give fields away: nothing can be dropped back into them. */
  readonly noDrop = () => false;

  /** Enter or "+" on a toolbox card adds it at the end of the open section; a used field is selected instead. */
  addField(code: string, index?: number) {
    if (this.usedCodes().has(code)) { this.selectField(code); return; }
    const section = this.activeSection();
    const type = this.entry(code).field.type;
    const field: TemplateField = { code, width: FULL_BY_DEFAULT.includes(type) ? 'FULL' : 'HALF', textRows: type === 'LONG_TEXT' ? 3 : null };
    this.updateSection(section.key, fields => {
      const next = [...fields];
      next.splice(index ?? next.length, 0, field);
      return next;
    });
    this.selectedCode.set(code);
    this.say(`${this.entry(code).field.label} adicionado à seção ${section.name}.`);
  }

  /** Drop on the sheet: from the toolbox it adds the field at that position; within the sheet it reorders. */
  dropOnSheet(event: CdkDragDrop<TemplateField[]>) {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      this.updateSection(this.activeSection().key, fields => {
        const next = [...fields];
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        return next;
      });
      return;
    }
    this.addField(event.item.data as string, event.currentIndex);
  }

  // Sheet fields
  selectField(code: string) {
    this.closeMenus();
    const section = this.sections().find(item => item.fields.some(field => field.code === code));
    if (!section) return;
    this.activeSectionKey.set(section.key);
    this.selectedCode.set(code);
    setTimeout(() => document.getElementById('sheet-field-' + code)?.scrollIntoView?.({ block: 'nearest' }));
  }

  removeField(code: string) {
    this.closeMenus();
    const label = this.entry(code).field.label;
    this.sections.update(sections => sections.map(section => ({ ...section, fields: section.fields.filter(field => field.code !== code) })));
    if (this.selectedCode() === code) this.selectedCode.set(null);
    this.say(`${label} removido do modelo.`);
  }

  /** Alt+↑/↓ on a selected field. */
  moveField(code: string, delta: -1 | 1) {
    const section = this.activeSection();
    const from = section.fields.findIndex(field => field.code === code);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= section.fields.length) return;
    this.updateSection(section.key, fields => {
      const next = [...fields];
      moveItemInArray(next, from, to);
      return next;
    });
    this.say(`${this.entry(code).field.label} na posição ${to + 1} de ${section.fields.length}.`);
    this.focus('sheet-field-' + code);
  }

  /** Goes to the end of the other section, which opens with the field still selected. */
  moveFieldToSection(code: string, sectionKey: number) {
    this.closeMenus();
    const placement = this.sections().flatMap(section => section.fields).find(field => field.code === code);
    const target = this.sections().find(section => section.key === sectionKey);
    if (!placement || !target || target.fields.some(field => field.code === code)) return;
    this.sections.update(sections => sections.map(section => section.key === sectionKey
      ? { ...section, fields: [...section.fields, placement] }
      : { ...section, fields: section.fields.filter(field => field.code !== code) }));
    this.activeSectionKey.set(sectionKey);
    this.selectedCode.set(code);
    this.say(`${this.entry(code).field.label} movido para ${target.name}.`);
  }

  setWidth(code: string, width: FieldWidth) {
    if (this.entry(code).field.type === 'TABLE') return;
    this.updateField(code, field => ({ ...field, width }));
  }

  setTextRows(code: string, textRows: number) {
    this.updateField(code, field => ({ ...field, textRows }));
  }

  // Sections as tabs: click opens; double click or F2 renames; right click opens the menu; dragging reorders.
  selectSection(key: number) {
    this.pendingSectionRemoval.set(null);
    this.activeSectionKey.set(key);
  }

  stepSection(direction: -1 | 1) {
    const sections = this.sections();
    const next = sections[(this.activeIndex() + direction + sections.length) % sections.length];
    this.selectSection(next.key);
    this.focus('section-tab-' + next.key);
  }

  addSection() {
    if (this.sections().length >= MAX_SECTIONS) return;
    const section: EditSection = { key: this.nextKey++, name: `Seção ${this.sections().length + 1}`, fields: [] };
    this.sections.update(sections => [...sections, section]);
    this.activeSectionKey.set(section.key);
    this.startRenameSection(section.key);
  }

  startRenameSection(key: number) {
    this.closeMenus();
    this.selectSection(key);
    this.editingSectionKey.set(key);
    this.focus('section-name-' + key, true);
  }

  /** Blank keeps the previous name. */
  renameSection(key: number, value: string) {
    if (this.editingSectionKey() !== key) return;
    this.editingSectionKey.set(null);
    const trimmed = value.trim().slice(0, MAX_NAME);
    if (trimmed) this.sections.update(sections => sections.map(section => section.key === key ? { ...section, name: trimmed } : section));
  }

  cancelRenameSection(key: number) {
    this.editingSectionKey.set(null);
    this.focus('section-tab-' + key);
  }

  dropSection(event: CdkDragDrop<unknown>) {
    this.moveSection(event.previousIndex, event.currentIndex);
  }

  moveSectionBy(key: number, delta: -1 | 1) {
    this.closeMenus();
    const from = this.sections().findIndex(section => section.key === key);
    this.moveSection(from, from + delta);
  }

  private moveSection(from: number, to: number) {
    const count = this.sections().length;
    if (from === to || from < 0 || to < 0 || from >= count || to >= count) return;
    this.sections.update(sections => {
      const next = [...sections];
      moveItemInArray(next, from, to);
      return next;
    });
  }

  /** An empty section goes at once; one with fields asks first. The only section stays. */
  requestRemoveSection(key: number) {
    this.closeMenus();
    const section = this.sections().find(item => item.key === key);
    if (!section || this.sections().length <= 1) return;
    if (!section.fields.length) { this.removeSection(key); return; }
    this.selectSection(key);
    this.pendingSectionRemoval.set(key);
  }

  /** Its fields go back to the toolbox. */
  removeSection(key: number) {
    this.pendingSectionRemoval.set(null);
    const sections = this.sections();
    const index = sections.findIndex(section => section.key === key);
    if (index < 0 || sections.length <= 1) return;
    const removed = sections[index];
    const remaining = sections.filter(section => section.key !== key);
    this.sections.set(remaining);
    if (this.activeSectionKey() === key) this.activeSectionKey.set(remaining[Math.min(index, remaining.length - 1)].key);
    if (removed.fields.some(field => field.code === this.selectedCode())) this.selectedCode.set(null);
    const count = removed.fields.length;
    this.say(`Seção ${removed.name} excluída${count ? `; ${count} ${count === 1 ? 'campo voltou' : 'campos voltaram'} à caixa de ferramentas` : ''}.`);
  }

  // Right-click menus, at the cursor (or under the element when opened from the keyboard).
  openSectionMenu(key: number, event: MouseEvent) {
    event.preventDefault();
    this.selectSection(key);
    this.fieldMenu.set(null);
    this.sectionMenu.set({ key, ...this.menuPosition(event) });
    this.focusFirstMenuItem();
  }

  openFieldMenu(code: string, event: MouseEvent) {
    event.preventDefault();
    this.selectedCode.set(code);
    this.sectionMenu.set(null);
    this.fieldMenu.set({ key: code, ...this.menuPosition(event) });
    this.focusFirstMenuItem();
  }

  closeMenus(focusId?: string) {
    this.sectionMenu.set(null);
    this.fieldMenu.set(null);
    if (focusId) this.focus(focusId);
  }

  /** Up/down move between the items; Esc closes and returns focus; Tab closes. */
  menuKey(event: KeyboardEvent, focusId: string) {
    const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeMenus(focusId);
    } else if (event.key === 'Tab') {
      this.closeMenus();
    }
  }

  sectionIndex(key: number | string) { return this.sections().findIndex(section => section.key === key); }
  otherSections(code: string) { return this.sections().filter(section => !section.fields.some(field => field.code === code)); }

  private menuPosition(event: MouseEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    const x = fromKeyboard ? box.left : event.clientX;
    const y = fromKeyboard ? box.bottom : event.clientY;
    return { x: Math.max(8, Math.min(x, window.innerWidth - 248)), y: Math.max(8, Math.min(y, window.innerHeight - 200)) };
  }

  private focusFirstMenuItem() {
    setTimeout(() => (document.querySelector('.oficina-menu [role="menuitem"]') as HTMLElement | null)?.focus());
  }

  private updateSection(key: number, change: (fields: TemplateField[]) => TemplateField[]) {
    this.sections.update(sections => sections.map(section => section.key === key ? { ...section, fields: change(section.fields) } : section));
  }

  private updateField(code: string, change: (field: TemplateField) => TemplateField) {
    this.sections.update(sections => sections.map(section => ({
      ...section, fields: section.fields.map(field => field.code === code ? change(field) : field) })));
  }

  private focus(id: string, select = false) {
    setTimeout(() => {
      const element = document.getElementById(id) as HTMLInputElement | null;
      element?.focus();
      if (select) element?.select?.();
    });
  }

  private say(message: string) {
    this.announcement.set(message);
  }
}
