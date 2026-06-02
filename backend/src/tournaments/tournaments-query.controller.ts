import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TournamentsQueryService } from './tournaments-query.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TournamentQueryDto } from './dto/tournament-query.dto';

@ApiTags('Tournaments (Пошук та Читання)')
@Controller('tournaments')
export class TournamentsQueryController {
  constructor(private readonly queryService: TournamentsQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати список всіх турнірів' })
  findAll(@Query() query: TournamentQueryDto) {
    return this.queryService.findAll(query);
  }
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Отримати список турнірів, які створив поточний користувач',
  })
  findMyTournaments(
    @CurrentUser() user: JwtPayload,
    @Query() query: TournamentQueryDto,
  ) {
    return this.queryService.findMyTournaments(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати деталі турніру за ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryService.findOne(id);
  }
}
