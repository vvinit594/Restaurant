import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isHttpImageUrl', async: false })
export class IsHttpImageUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (v.startsWith('data:')) return false;
    return /^https?:\/\//i.test(v) && v.length <= 2048;
  }

  defaultMessage() {
    return 'Image must be an http(s) URL (Base64 data URLs are not allowed).';
  }
}

export function IsHttpImageUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsHttpImageUrlConstraint,
    });
  };
}
