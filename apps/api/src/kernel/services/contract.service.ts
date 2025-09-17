import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { validateWithZod, ValidationError } from '@tms/contracts';

@Injectable()
export class ContractService {
  /**
   * Validate data against a Zod schema
   */
  validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new BadRequestException({
          message: 'Validation failed',
          errors,
        });
      }
      throw error;
    }
  }

  /**
   * Validate with detailed result
   */
  validateWithResult<T>(schema: z.ZodSchema<T>, data: unknown) {
    return validateWithZod(schema, data);
  }

  /**
   * Transform and validate
   */
  transform<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ValidationError('Transformation failed', result.error.errors);
    }
    return result.data;
  }
}
