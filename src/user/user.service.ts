import { ConflictException, Injectable } from '@nestjs/common';
import { RegisterUserDto } from '../auth/dto/registerUser.dto';
import { InjectModel } from '@nestjs/mongoose/dist/common/mongoose.decorators';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
import { LoginUserDto } from '../auth/dto/loginUserDto';

@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }

    async createUser(registerUserDto: RegisterUserDto, otp: string, otpExpiresAt: Date) {
        try {
            return await this.userModel.create({
                fName: registerUserDto.fName,
                lName: registerUserDto.lName,
                password: registerUserDto.password,
                email: registerUserDto.email,
                isVerified: false,
                otp,
                otpExpiresAt,
            });
        } catch (err: unknown) {
            const e = err as { code?: number };
            const DUPLICATE_KEY_ERROR_CODE = 11000;
            if (e.code === DUPLICATE_KEY_ERROR_CODE) {
                throw new ConflictException('Email already exists');
            }
            throw new Error('An error occurred while creating the user');
        }
    }

    async findByEmail(email: string) {
        return await this.userModel.findOne({ email }).exec();
    }

    async updateOtp(email: string, otp: string, otpExpiresAt: Date, password?: string) {
        const updatePayload: Record<string, unknown> = { otp, otpExpiresAt };
        if (password) {
            updatePayload.password = password;
        }
        return await this.userModel
            .findOneAndUpdate({ email }, updatePayload, { returnDocument: 'after' })
            .exec();
    }

    async markEmailVerified(email: string) {
        return await this.userModel
            .findOneAndUpdate(
                { email },
                { isVerified: true, otp: null, otpExpiresAt: null },
                { returnDocument: 'after' },
            )
            .exec();
    }

    /// This is login function which takes LoginUserDto as input and returns the user if the email exists
    async loginUser(loginUserDto: LoginUserDto) {
        try {
            return await this.userModel.findOne({ email: loginUserDto.email }).exec();
        } catch (err: unknown) {
            console.log(err);
            throw new Error('An error occurred while logging in the user');
        }
    }

    async getUserById(id: string) {
        try {
            return await this.userModel.findOne({ _id: id }).exec();
        } catch (err: unknown) {
            console.log(err);
            throw new Error('An error occurred while fetching the user');
        }
    }
}
