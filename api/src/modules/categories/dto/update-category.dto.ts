import { PartialType } from '@nestjs/swagger'
import { CreateCategoryDto } from './create-category.dto'

/**
 * `PartialType` deriva o DTO de atualizacao tornando todos os campos opcionais, mantendo
 * as validacoes e a documentacao Swagger de cada um.
 *
 * A alternativa seria reescrever a classe com `@IsOptional()` em tudo — e no dia em que
 * uma regra mudasse no create, a copia continuaria com a regra antiga. Este e o tipo de
 * duplicacao que nao falha de imediato: falha meses depois, com dados invalidos entrando
 * so pela rota de update.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
