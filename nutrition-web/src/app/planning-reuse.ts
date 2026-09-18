import { ComponentRef, inject, Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, DetachedRouteHandle } from '@angular/router';
import { Session } from './auth/session';

/**
 * Keeps the planning screen alive while the nutritionist moves between sidebar screens, so meals and targets are not
 * lost by visiting Pacientes or Perfil. Nothing is saved: reloading the page still discards the planning.
 * A planning kept under another session (logout or another account) is destroyed instead of reattached.
 */
@Injectable()
export class PlanningReuseStrategy extends BaseRouteReuseStrategy {
  // Session is resolved lazily: it depends on Router, which depends on this strategy.
  private readonly injector = inject(Injector);
  private stored: { handle: DetachedRouteHandle; owner: string | null } | null = null;

  override shouldDetach(route: ActivatedRouteSnapshot) { return isPlanning(route); }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null) {
    if (!isPlanning(route)) return;
    this.stored = handle ? { handle, owner: this.token() } : null;
  }

  override shouldAttach(route: ActivatedRouteSnapshot) {
    if (!isPlanning(route) || !this.stored) return false;
    if (this.stored.owner === this.token()) return true;
    // Planning of another session: never show it again.
    (this.stored.handle as { componentRef?: ComponentRef<unknown> }).componentRef?.destroy();
    this.stored = null;
    return false;
  }

  override retrieve(route: ActivatedRouteSnapshot) {
    return isPlanning(route) ? this.stored?.handle ?? null : null;
  }

  private token() { return this.injector.get(Session).token(); }
}

function isPlanning(route: ActivatedRouteSnapshot) {
  return route.routeConfig?.path === 'planejamento';
}
