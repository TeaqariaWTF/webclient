import { Component, Inject, OnInit } from '@angular/core';
import { NgbDropdownConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppState, AuthState, MailBoxesState, MailState, UserState } from '../../store/datatypes';
import { Store } from '@ngrx/store';
import { OnDestroy, TakeUntilDestroy } from 'ngx-take-until-destroy';
import { Observable } from 'rxjs';
import { ComposeMailService } from '../../store/services/compose-mail.service';
import { CreateFolderComponent } from '../dialogs/create-folder/create-folder.component';
import { Folder, Mail, Mailbox, MailFolderType } from '../../store/models/mail.model';
import { DOCUMENT } from '@angular/common';
import { BreakpointsService } from '../../store/services/breakpoint.service';
import { NotificationService } from '../../store/services/notification.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { GetMails, GetMailsSuccess, GetUnreadMailsCount, GetUnreadMailsCountSuccess, ReadMailSuccess } from '../../store/actions';
import { filter, takeUntil } from 'rxjs/operators';
import { WebsocketService } from '../../shared/services/websocket.service';
import { WebSocketState } from '../../store';
import { PushNotificationOptions, PushNotificationService } from 'ngx-push-notifications';
import { Title } from '@angular/platform-browser';

@TakeUntilDestroy()
@Component({
  selector: 'app-mail-sidebar',
  templateUrl: './mail-sidebar.component.html',
  styleUrls: ['./mail-sidebar.component.scss']
})
export class MailSidebarComponent implements OnInit, OnDestroy {

  LIMIT = 3;
  EMAIL_LIMIT = 20;

  readonly destroyed$: Observable<boolean>;

  // Public property of boolean type set false by default
  public isComposeVisible: boolean = false;
  public userState: UserState;

  mailState: MailState;
  currentRoute: string;

  isMenuOpened: boolean;
  isSidebarOpened: boolean;
  customFolders: Folder[] = [];
  currentMailbox: Mailbox;

  constructor(private store: Store<AppState>,
              private modalService: NgbModal,
              config: NgbDropdownConfig,
              private breakpointsService: BreakpointsService,
              private composeMailService: ComposeMailService,
              private notificationService: NotificationService,
              private router: Router,
              private websocketService: WebsocketService,
              private pushNotificationService: PushNotificationService,
              private titleService: Title,
              private activatedRoute: ActivatedRoute,
              @Inject(DOCUMENT) private document: Document) {
    // customize default values of dropdowns used by this component tree
    config.autoClose = 'outside';

    this.router.events.pipe(takeUntil(this.destroyed$))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.currentRoute = event.url;
        }
      });
    const nextPage = localStorage.getItem('nextPage');
    if (nextPage) {
      localStorage.setItem('nextPage', '');
      this.router.navigateByUrl(nextPage);
    }

    this.store.dispatch(new GetUnreadMailsCount());
    this.websocketService.connect();

    // listen to web sockets events of new emails from server.
    this.store.select(state => state.webSocket).pipe(takeUntil(this.destroyed$))
      .subscribe((webSocketState: WebSocketState) => {
        if (webSocketState.message && !webSocketState.isClosed) {
          if (webSocketState.message.mail) {
            if (this.currentRoute && this.currentRoute.indexOf('/message/') < 0) {
              this.store.dispatch(new GetMailsSuccess({
                limit: this.EMAIL_LIMIT,
                offset: 0,
                folder: webSocketState.message.folder,
                read: false,
                mails: [webSocketState.message.mail],
                total_mail_count: webSocketState.message.total_count,
              }));
            }
            if (webSocketState.message.folder !== MailFolderType.SPAM) {
              this.showNotification(webSocketState.message.mail, webSocketState.message.folder);
              this.updateUnreadCount(webSocketState);
            }
          } else if (webSocketState.message.is_outbox_mail_sent) {
            this.store.dispatch(new GetUnreadMailsCountSuccess(
              { outbox: webSocketState.message.unread_count_outbox, updateUnreadCount: true, }));
            if (this.mailState.currentFolder === MailFolderType.OUTBOX) {
              this.store.dispatch(new GetMails({ limit: this.LIMIT, offset: 0, folder: MailFolderType.OUTBOX }));
            }

          } else if (webSocketState.message.marked_as_read !== null) {
            this.updateUnreadCount(webSocketState);
            this.store.dispatch(new ReadMailSuccess({
              ids: webSocketState.message.ids.join(','),
              read: webSocketState.message.marked_as_read,
            }));
          }
        }
      });
    this.store.select(state => state.auth).pipe(takeUntil(this.destroyed$))
      .subscribe((authState: AuthState) => {
        if (!authState.isAuthenticated) {
          this.websocketService.disconnect();
        }
      });
  }

  ngOnInit() {

    const isGranted: any = this.pushNotificationService.isPermissionGranted;
    if (!isGranted()) {
      setTimeout(() => {
        this.pushNotificationService.requestPermission();
      }, 3000);
    }

    this.store.select(state => state.user).pipe(takeUntil(this.destroyed$))
      .subscribe((user: UserState) => {
        this.userState = user;
        this.EMAIL_LIMIT = this.userState.settings.emails_per_page ? this.userState.settings.emails_per_page : 20;
        this.customFolders = user.customFolders;
        if (this.breakpointsService.isSM() || this.breakpointsService.isXS()) {
          this.LIMIT = this.customFolders.length;
        }
      });

    this.store.select(state => state.mailboxes).pipe(takeUntil(this.destroyed$))
      .subscribe((mailboxes: MailBoxesState) => {
        this.currentMailbox = mailboxes.currentMailbox;
      });

    this.store.select(state => state.mail).pipe(takeUntil(this.destroyed$))
      .subscribe((mailState: MailState) => {
        this.mailState = mailState;
        this.updateTitle();

      });
    this.router.events.pipe(takeUntil(this.destroyed$), filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.url === '/mail/settings' || event.url === '/mail/contacts') {
          this.updateTitle(`${this.capitalize(event.url.split('/mail/')[1])} - CTemplar: Armored Email`);
        }
      });
  }

  private updateUnreadCount(webSocketState: WebSocketState) {
    const data = { updateUnreadCount: true };
    for (const key in webSocketState.message) {
      if (webSocketState.message.hasOwnProperty(key) && key.indexOf('unread_count_') === 0) {
        data[key.split('unread_count_')[1]] = webSocketState.message[key];
      }
    }
    this.store.dispatch(new GetUnreadMailsCountSuccess(data));
  }

  updateTitle(title: string = null) {
    // Set tab title
    if (!title) {
      title = `${this.mailState.currentFolder ? this.capitalize(this.mailState.currentFolder) : ''} `;
      if (this.mailState.currentFolder && this.mailState.unreadMailsCount[this.mailState.currentFolder] &&
        (this.mailState.currentFolder === 'inbox' || this.customFolders.some(folder => this.mailState.currentFolder === folder.name))) {
        title += `(${this.mailState.unreadMailsCount[this.mailState.currentFolder]}) - `;
      } else if (this.mailState.currentFolder) {
        title += ' - ';
      }
      title += 'CTemplar: Armored Email';
    }
    this.titleService.setTitle(title);
  }

  capitalize(s) {
    if (typeof s !== 'string') {
      return '';
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * @description
   * Prime Users - Can create as many folders as they want
   * Free Users - Only allow a maximum of 3 folders per account
   */
  // == Open NgbModal
  open() {
    if (this.userState.isPrime) {
      this.modalService.open(CreateFolderComponent, { centered: true, windowClass: 'modal-sm mailbox-modal' });
    } else if (this.userState.customFolders === null || this.userState.customFolders.length < 3) {
      this.modalService.open(CreateFolderComponent, { centered: true, windowClass: 'modal-sm mailbox-modal' });
    } else {
      this.notificationService.showSnackBar('Free users can only create a maximum of 3 folders.');
    }
  }

  // == Show mail compose modal
  openComposeMailDialog() {
    this.composeMailService.openComposeMailDialog();
  }

  toggleDisplayLimit(totalItems) {
    if (this.LIMIT === totalItems) {
      this.LIMIT = 3;
    } else {
      this.LIMIT = totalItems;
    }
  }

  toggleMenu(event?: any) { // click handler
    if (this.breakpointsService.isXS()) {
      if (this.isMenuOpened) {
        this.document.body.classList.remove('menu-open');
        this.isMenuOpened = false;
      }
      if (this.document.body.classList.contains('menu-open')) {
        this.isMenuOpened = true;
      }
    } else if (this.breakpointsService.isSM() || this.breakpointsService.isMD()) {
      if (event) {
        this.isSidebarOpened = false;
      } else {
        this.isSidebarOpened = !this.isSidebarOpened;
      }
    }
  }

  showNotification(mail: Mail, folder: string) {
    const title = mail.sender_display.name;
    const options = new PushNotificationOptions();
    options.body = 'You have received a new email';
    options.icon = 'https://ctemplar.com/assets/images/media-kit/mediakit-logo4.png';

    this.pushNotificationService.create(title, options).subscribe((notif) => {
        if (notif.event.type === 'click') {
          notif.notification.close();
          window.open(`/mail/${folder}/page/1/message/${mail.id}`, '_blank');
        }
      },
      (err) => {
        console.log(err);
      });
  }


  ngOnDestroy(): void {
    this.titleService.setTitle('CTemplar: Armored Email');
  }
}
