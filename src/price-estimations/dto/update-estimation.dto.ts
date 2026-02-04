import { PartialType } from '@nestjs/mapped-types';
import { CreateEstimationDto } from './create-estimation.dto';

export class UpdateEstimationDto extends PartialType(CreateEstimationDto) {}