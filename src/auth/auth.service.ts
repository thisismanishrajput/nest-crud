import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterUserDto } from './dto/registerUser.dto';
import bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/loginUserDto';
import { MailService } from '../mail/mail.service';
import { VerifyOtpDto } from './dto/verifyOtp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userServices: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getOtpExpiry(): Date {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  async registerUser(registerUserDto: RegisterUserDto) {
    const existingUser = await this.userServices.findByEmail(registerUserDto.email);
    if (existingUser?.isVerified) {
      throw new ConflictException('Email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerUserDto.password, saltRounds);
    const otp = this.generateOtp();
    const otpExpiresAt = this.getOtpExpiry();

    if (existingUser) {
      await this.userServices.updateOtp(registerUserDto.email, otp, otpExpiresAt, hashedPassword);
    } else {
      await this.userServices.createUser(
        { ...registerUserDto, password: hashedPassword },
        otp,
        otpExpiresAt,
      );
    }

    await this.mailService.sendVerificationOtpEmail(
      registerUserDto.email,
      `${registerUserDto.fName} ${registerUserDto.lName}`,
      otp,
    );

    return {
      message: 'Verification OTP sent to your email. It will expire in 10 minutes.',
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const user = await this.userServices.findByEmail(verifyOtpDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    if (user.isVerified) {
      const payload = { email: user.email, sub: user._id };
      return { access_token: await this.jwtService.signAsync(payload) };
    }

    if (!user.otp || !user.otpExpiresAt || user.otp !== verifyOtpDto.otp) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    if (new Date(user.otpExpiresAt) < new Date()) {
      throw new UnauthorizedException('OTP has expired. Please request a new code.');
    }

    await this.userServices.markEmailVerified(user.email);

    const payload = { email: user.email, sub: user._id };
    return { access_token: await this.jwtService.signAsync(payload) };
  }

  async loginUser(loginUserDto: LoginUserDto) {
    const user = await this.userServices.loginUser(loginUserDto);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified. Please verify the OTP sent to your email.');
    }

    const passwordMatches = await bcrypt.compare(loginUserDto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

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
