import { Resend } from 'resend';

const resend = new Resend('re_dEvujjQ7_qowDjyttou5BRHdmfSXKsutT');

resend.emails.send({
  from: 'onboarding@resend.dev',
  to: 'arieftediansyah0@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
});