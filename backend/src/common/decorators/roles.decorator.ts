import { SetMetadata } from '@nestjs/common';
import { AppRole, ROLES_KEY } from '../constants';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
