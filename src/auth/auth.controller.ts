import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RegisterUserDto } from './dto/registerUser.dto';
import { LoginUserDto } from './dto/loginUserDto';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService
    ) { }

    @Post("register")
    async register(@Body() registerUserDto: RegisterUserDto) {
        const token = await this.authService.regisgterUser(registerUserDto)
        return { "access_token": token };
    }

    @Post("login")
    async login(@Body() loginUserDto: LoginUserDto) {
        const result = await this.authService.loginUser(loginUserDto);
        return result;
    }


    @UseGuards(AuthGuard)
    @Get("profile")
    async getProfile(@Request() req) {
        const userId = req.user.sub;
        const user = await this.authService.getUserById(userId);
        return {
            email: user?.email,
            fName: user?.fName,
            lName: user?.lName,
            role: user?.role,

        }
    }
}
