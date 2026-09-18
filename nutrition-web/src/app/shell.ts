import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component: only hosts the routes. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class Shell {}
