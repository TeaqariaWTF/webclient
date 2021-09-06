import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StoreModule } from '@ngrx/store';

import { ImportPrivateKeyComponent } from './import-private-key.component';

describe('ImportPrivateKeyComponent', () => {
  let component: ImportPrivateKeyComponent;
  let fixture: ComponentFixture<ImportPrivateKeyComponent>;

  beforeEach((() => {
    TestBed.configureTestingModule({
      declarations: [ImportPrivateKeyComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportPrivateKeyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
