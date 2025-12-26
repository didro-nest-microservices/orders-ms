import { IsString, IsUrl, IsUUID } from 'class-validator';

export class PaidOrderDto {
  @IsString()
  paymentId: string;

  @IsString()
  @IsUUID()
  orderId: string;

  @IsString()
  @IsUrl()
  receiptUrl: string;
}
