import { ConflictException, NotFoundException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { Connection, Repository, UpdateResult } from 'typeorm';
import { CreateUserDto } from './dto/user.create-dto';
import { LoginUserDto } from './dto/user.login-dto';
import { UpdateUserDto } from './dto/user.update-dto';
import { AddressEntity } from './entity/address.entity';
import { UserEntity } from './entity/user.entity';

@Injectable()
export class UserService {
    constructor (
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(AddressEntity)
        private addressRepository: Repository<AddressEntity>,
        private authService: AuthService,
        private connection: Connection, // transaction을 위해 필요
    ){}
    
    // POST -> 특정 사용자 생성하기
    async createUser (user: CreateUserDto): Promise<UserEntity> {
        const { email, password, name, age, country, city, street, zipCode } = user;
        const findUser: UserEntity = await this.userRepository.findOne({ email });
        if (findUser) throw new ConflictException(`${email} is already created user. Create another user.`);
        const hashPassword: string = await this.authService.hashPassword(password);
        const saveAddress: AddressEntity = await this.addressRepository.save({ country, city, street, zipCode });
        return this.userRepository.save({ email, name, age, password: hashPassword, address: saveAddress });
    }

    // POST -> 사용자 로그인 하기
    async login (loginUser: UserEntity): Promise<LoginUserDto>{
        const accessToken: string = await this.authService.generateJWT(loginUser);
        return { accessToken };
    }

    // POST -> 다수의 사용자 생성하기 (+트랜젝션 처리)
    async createManyUser (users: CreateUserDto[]): Promise<void>{
        const queryRunner = this.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            for (const user of users) {
                const { email, password, name, age, country, city, street, zipCode } = user;
                const hashPassword: string = await this.authService.hashPassword(password);
                const saveAddress: AddressEntity = await this.addressRepository.save({ country, city, street, zipCode });
            
                const userEntity = new UserEntity();
                Object.assign(userEntity, { email, name, age, password: hashPassword, address: saveAddress });
                await queryRunner.manager.save(userEntity);
            }
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    }

    // GET -> 전체 사용자 정보 조회하기
    async findAll (): Promise<UserEntity[]>{
        return await this.userRepository.find({ relations: ['address'] });
    }

    // GET -> 특정 아이디로 사용자 정보 조회하기
    async findUserById (id: number): Promise<UserEntity>{
        const selectedUser: UserEntity = await this.userRepository.findOne({ id }, { relations: ['address'] });
        if (!selectedUser) throw new NotFoundException(`there is no user with ID ${id}`);
        return selectedUser;
    }

    // GET -> 특정 키워드로 사용자의 정보 조회하기
    async findUserByEmail (email: string): Promise<UserEntity>{
        const selectedUser: UserEntity = await this.userRepository.findOne({ email }, { relations: ['address'] });
        if (!selectedUser) throw new NotFoundException(`there is no user with email->(${email})`);
        return selectedUser;
    }

    // PATCH -> 특정 아이디로 사용자의 정보 수정하기
    async updateUserById (userId: number, updateUserDto: UpdateUserDto): Promise<UpdateResult> {
        return await this.userRepository.update(userId, updateUserDto);
    }

    // DELETE -> 특정 아이디로 사용자 정보 삭제하기
    async removeUserById (userId: number): Promise<void>{
        const user: UserEntity = await this.findUserById(userId);
        await this.userRepository.delete(userId);
        
        // user테이블에 외래키로 있는 addressId가 먼저 지워져야지만 address테이블의 해당 로우가 정상삭제된다.
        this.addressRepository.delete(user.address.id); 
    }
}
