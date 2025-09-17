// Validation utilities using both Zod and AJV
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { z } from 'zod';

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });
addFormats(ajv);

// Validation result type
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Zod validation wrapper
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult {
  try {
    schema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      valid: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }]
    };
  }
}

// AJV validation wrapper
export function validateWithAjv(
  schema: object,
  data: unknown
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(err => ({
        field: err.instancePath || err.schemaPath,
        message: err.message || 'Validation failed'
      }))
    };
  }
  
  return { valid };
}

// Custom validation error
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodIssue[] | Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}