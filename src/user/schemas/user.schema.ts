
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../user.types';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
    @Prop({required: true})
    fName!: string;

    @Prop({required: true})
    lName!: string;

    @Prop({required: true, unique: true})
    email!: string;

    @Prop({required: true})
    password!: string;

    @Prop({default: false})
    isVerified!: boolean;

    @Prop()
    otp?: string;

    @Prop()
    otpExpiresAt?: Date;

    @Prop({default: UserRole.STUDENT})
    role!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
