import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterUserDto } from './dto/registerUser.dto';
import bcrypt from 'bcrypt'
import { LoginUserDto } from './dto/loginUserDto';

@Injectable()
export class AuthService {
    constructor(private readonly userServices: UserService,
        private readonly jwtService: JwtService){}

    async regisgterUser( registerUserDto: RegisterUserDto){
        const saltRounds = 10;
        const hash = await bcrypt.hash(registerUserDto.password,saltRounds);
        const user = await this.userServices.createUser({...registerUserDto,password: hash})
    
        const payload = { email: user.email, sub: user._id };
        return await this.jwtService.signAsync(payload);
    }

    async loginUser(loginUserDto: LoginUserDto) {
        const user = await this.userServices.loginUser(loginUserDto);
        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
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
    async getUserById(id: string){
        return await this.userServices.getUserById(id);
    }
}
