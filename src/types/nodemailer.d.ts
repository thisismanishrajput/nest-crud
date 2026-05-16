declare module 'nodemailer' {
  export type SendMailOptions = {
    from: string;
    to: string;
    subject: string;
    html: string;
  };

  export type Transporter = {
    sendMail(mailOptions: SendMailOptions): Promise<unknown>;
  };

  export type TransportOptions = {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    tls?: {
      rejectUnauthorized: boolean;
    };
  };

  export function createTransport(options: TransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
