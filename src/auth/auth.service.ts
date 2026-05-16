import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterUserDto } from './dto/registerUser.dto';
import bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/loginUserDto';
import { MailService } from '../mail/mail.service';
import { VerifyOtpDto } from './dto/verifyOtp.dto';
import { randomInt } from 'crypto';

@Injectable()
export class AuthService {
  private readonly otpSaltRounds = 10;
  private readonly passwordSaltRounds = 10;
  private readonly maxOtpAttempts = 5;
  private readonly otpResendCooldownMs = 60 * 1000;
  private readonly maxLoginFailures = 5;
  private readonly loginFailureWindowMs = 15 * 60 * 1000;
  private readonly loginFailures = new Map<
    string,
    { count: number; firstFailedAt: number }
  >();

  constructor(
    private readonly userServices: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private getOtpExpiry(): Date {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private assertLoginNotThrottled(email: string) {
    const failure = this.loginFailures.get(email);
    if (!failure) {
      return;
    }

    const failureAge = Date.now() - failure.firstFailedAt;
    if (failureAge > this.loginFailureWindowMs) {
      this.loginFailures.delete(email);
      return;
    }

    if (failure.count >= this.maxLoginFailures) {
      throw new UnauthorizedException(
        'Too many failed login attempts. Please try again later.',
      );
    }
  }

  private trackFailedLogin(email: string) {
    const failure = this.loginFailures.get(email);
    if (
      !failure ||
      Date.now() - failure.firstFailedAt > this.loginFailureWindowMs
    ) {
      this.loginFailures.set(email, { count: 1, firstFailedAt: Date.now() });
      return;
    }

    this.loginFailures.set(email, {
      count: failure.count + 1,
      firstFailedAt: failure.firstFailedAt,
    });
  }

  async registerUser(registerUserDto: RegisterUserDto) {
    const email = this.normalizeEmail(registerUserDto.email);
    const existingUser = await this.userServices.findByEmail(email);
    if (existingUser?.isVerified) {
      throw new ConflictException('Email already exists');
    }

    if (
      existingUser?.otpLastSentAt &&
      Date.now() - new Date(existingUser.otpLastSentAt).getTime() <
        this.otpResendCooldownMs
    ) {
      throw new UnauthorizedException(
        'Please wait before requesting another OTP.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      registerUserDto.password,
      this.passwordSaltRounds,
    );
    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, this.otpSaltRounds);
    const otpExpiresAt = this.getOtpExpiry();

    if (existingUser) {
      await this.userServices.updateOtp(
        email,
        hashedOtp,
        otpExpiresAt,
        hashedPassword,
      );
    } else {
      await this.userServices.createUser(
        { ...registerUserDto, email, password: hashedPassword },
        hashedOtp,
        otpExpiresAt,
      );
    }

    await this.mailService.sendVerificationOtpEmail(
      registerUserDto.email,
      `${registerUserDto.fName} ${registerUserDto.lName}`,
      otp,
    );

    return {
      message:
        'Verification OTP sent to your email. It will expire in 10 minutes.',
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const email = this.normalizeEmail(verifyOtpDto.email);
    const user = await this.userServices.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    if (user.isVerified) {
      throw new UnauthorizedException(
        'Email is already verified. Please login.',
      );
    }

    if ((user.otpAttempts ?? 0) >= this.maxOtpAttempts) {
      await this.userServices.clearOtp(email);
      throw new UnauthorizedException(
        'Too many invalid OTP attempts. Please request a new code.',
      );
    }

    if (!user.otp || !user.otpExpiresAt) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    if (new Date(user.otpExpiresAt) < new Date()) {
      await this.userServices.clearOtp(email);
      throw new UnauthorizedException(
        'OTP has expired. Please request a new code.',
      );
    }

    const otpMatches = await bcrypt.compare(verifyOtpDto.otp, user.otp);
    if (!otpMatches) {
      await this.userServices.incrementOtpAttempts(email);
      throw new UnauthorizedException('Invalid email or OTP');
    }

    await this.userServices.markEmailVerified(user.email);

    const payload = { email: user.email, sub: user._id };
    return { access_token: await this.jwtService.signAsync(payload) };
  }

  async loginUser(loginUserDto: LoginUserDto) {
    const email = this.normalizeEmail(loginUserDto.email);
    this.assertLoginNotThrottled(email);

    const user = await this.userServices.loginUser({ ...loginUserDto, email });
    if (!user) {
      this.trackFailedLogin(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please verify the OTP sent to your email.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      loginUserDto.password,
      user.password,
    );
    if (!passwordMatches) {
      this.trackFailedLogin(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.loginFailures.delete(email);

    const payload = { email: user.email, sub: user._id };
    const token = await this.jwtService.signAsync(payload);
    return {
      access_token: token,
      user: {
        email: user.email,
        fName: user.fName,
        lName: user.lName,
        role: user.role,
      },
    };
  }

  async getUserById(id: string) {
    return await this.userServices.getUserById(id);
  }
}
