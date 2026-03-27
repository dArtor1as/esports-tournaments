import { PartialType } from '@nestjs/swagger';
import { SimulateTournamentDto } from './simulate-tournament.dto';

export class UpdateGeneticSimulatorDto extends PartialType(
  SimulateTournamentDto,
) {}
