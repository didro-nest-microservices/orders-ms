import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from 'src/config';
import { PrismaService } from '../prisma.service';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';

interface Product {
  id: number;
  name: string;
  price: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  ) {}

  private getItem(products: Product[], productId: number) {
    return products.find((product) => product.id === productId)!;
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const items = createOrderDto.items;
      const productIds = items.map((item) => item.productId);

      const products = await firstValueFrom<Product[]>(
        this.client.send({ cmd: 'validate_products' }, productIds),
      );

      const totalAmount = items.reduce((acc, item) => {
        const product = this.getItem(products, item.productId);
        return product.price * item.quantity + acc;
      }, 0);

      const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

      const order = await this.prisma.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: items.map((item) => ({
                price: this.getItem(products, item.productId).price,
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: { price: true, quantity: true, productId: true },
          },
        },
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((item) => ({
          ...item,
          name: this.getItem(products, item.productId).name,
        })),
      };
    } catch (error) {
      throw new RpcException(error);
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const total = await this.prisma.order.count({
      where: { status: orderPaginationDto.status },
    });

    const page = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;

    return {
      data: await this.prisma.order.findMany({
        skip: (page - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status,
        },
      }),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id },
      include: {
        OrderItem: {
          select: { price: true, quantity: true, productId: true },
        },
      },
    });

    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found`,
      });

    const productIds = order.OrderItem.map((item) => item.productId);
    const products = await firstValueFrom<Product[]>(
      this.client.send({ cmd: 'validate_products' }, productIds),
    );

    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => ({
        ...item,
        name: this.getItem(products, item.productId).name,
      })),
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);
    if (order.status === status) return order;

    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}
