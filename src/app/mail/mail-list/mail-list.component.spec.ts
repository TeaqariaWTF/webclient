import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { StoreModule } from '@ngrx/store';

import { MailListComponent } from './mail-list.component';

describe('MailListComponent', () => {
  let component: MailListComponent;
  let fixture: ComponentFixture<MailListComponent>;

  beforeEach((() => {
    TestBed.configureTestingModule({
      declarations: [MailListComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MailListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
