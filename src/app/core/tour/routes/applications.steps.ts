import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from 'src/app/services/tour.service';
import { goTo } from '../tour-helpers';
import { ROUTES } from './tour-routes';

export function getApplicationsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  return [
    {
      element: '#tour-applications-intro',
      popover: {
        title: 'Welcome to ApplyFlow',
        description:
          "This is where every application you send ends up. Before you compile your first one, let's set up a template and a CV — click Next to head to Templates.",
        onNextClick: () => goTo(tourService, router, ROUTES.templates),
      },
    },
  ];
}
