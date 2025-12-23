import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from 'generated/prisma/enums';
import { PaginationDto } from 'src/common';
import { OrderStatusList } from '../enum/order-enum';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatusList, {
    message: `Posible status values are ${OrderStatusList.toString()}`,
  })
  status: OrderStatus;
}
