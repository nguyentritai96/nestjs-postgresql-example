import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'address_korean' })
export class AddressEntity {
  	@PrimaryGeneratedColumn()
  	id: number;

  	@Column()
	country: string;
	  
	@Column()
	city: string;
	  
	@Column()
	street: string;
	  
	@Column()
	zipCode: string;
}
