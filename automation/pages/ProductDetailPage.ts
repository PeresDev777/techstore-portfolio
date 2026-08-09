import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import { HeaderComponent } from '@pages/components/HeaderComponent'
import type { TestProduct } from '@data/products'
import { productDetail } from '@utils/routes'
import { formatCents, readCents } from '@utils/money'

export class ProductDetailPage extends BasePage {
  /** A rota exige um id; `openProduct` sobrescreve a navegação padrão. */
  protected readonly path = '/products'
  protected readonly readyLocator: Locator = this.byTestId('product-detail-page')

  readonly header = new HeaderComponent(this.page)

  readonly name: Locator = this.byTestId('product-detail-name')
  readonly price: Locator = this.byTestId('product-detail-price')
  readonly description: Locator = this.byTestId('product-detail-description')
  readonly category: Locator = this.byTestId('product-detail-category')
  readonly rating: Locator = this.byTestId('product-detail-rating')
  readonly stock: Locator = this.byTestId('product-detail-stock')
  readonly image: Locator = this.byTestId('product-detail-image')
  readonly errorMessage: Locator = this.byTestId('product-detail-error')

  /**
   * Botão principal de compra.
   *
   * `product-detail-add-to-cart` e não `add-to-cart`: os produtos relacionados no fim da
   * página também expõem `add-to-cart`, e um locator ambíguo quebraria em strict mode.
   */
  get addButton(): Locator {
    return this.byTestId('product-detail-add-to-cart')
  }

  /** Botao de aumentar a quantidade A COMPRAR — local, nao toca no servidor. */
  get increaseButton(): Locator {
    return this.byTestId('quantity-increase')
  }

  async openProduct(productId: string): Promise<void> {
    await this.page.goto(productDetail(productId))
    await this.waitUntilReady()
  }

  /** Abre um produto que não existe, sem esperar a página de detalhe renderizar. */
  async openMissingProduct(productId: string): Promise<void> {
    await this.page.goto(productDetail(productId))
    await expect(this.errorMessage).toBeVisible()
  }

  async increaseQuantity(times = 1): Promise<void> {
    for (let index = 0; index < times; index++) {
      await this.byTestId('quantity-increase').click()
    }
  }

  async decreaseQuantity(times = 1): Promise<void> {
    for (let index = 0; index < times; index++) {
      await this.byTestId('quantity-decrease').click()
    }
  }

  async selectedQuantity(): Promise<number> {
    return Number(await this.byTestId('quantity-value').textContent())
  }

  async addToCart(): Promise<void> {
    /* O seletor de quantidade acima é LOCAL — só este clique fala com o servidor. */
    await this.mutatingCart(() => this.addButton.click())
  }

  /** Escolhe a quantidade e adiciona em um único passo — o caminho mais usado nos specs. */
  async addToCartWithQuantity(quantity: number): Promise<void> {
    await this.increaseQuantity(quantity - 1)
    await this.addToCart()
  }

  /**
   * Dados exibidos na tela, ja normalizados para comparacao.
   *
   * LEITOR e nao asseverador: a expectativa e do teste, entao quem compara e o spec. O
   * preco sai em centavos porque a pagina expoe `data-price-cents` (ADR-008) — comparar
   * numero em vez de `"R$ 1.299,90"` deixa o teste imune a formatacao e a locale.
   */
  async displayedProduct(): Promise<{
    name: string
    priceInCents: number
    priceLabel: string
    category: string
    rating: string
  }> {
    return {
      name: (await this.name.textContent()) ?? '',
      priceInCents: await readCents(this.price),
      priceLabel: (await this.price.textContent()) ?? '',
      category: (await this.category.textContent()) ?? '',
      rating: (await this.rating.textContent()) ?? '',
    }
  }

  /**
   * Forma esperada de `displayedProduct` para um produto da massa.
   *
   * Mora no page object porque descreve como a PAGINA apresenta o dado — a nota sai com
   * virgula decimal em pt-BR, o preco sai formatado. E conhecimento da tela, nao do teste.
   * O que o spec decide e QUAL produto espera; o formato e responsabilidade daqui.
   */
  static expected(product: TestProduct): Record<string, unknown> {
    return {
      name: product.name,
      priceInCents: product.price,
      priceLabel: formatCents(product.price),
      category: product.category,
      rating: expect.stringContaining(product.rating.toString().replace('.', ',')),
    }
  }

  /**
   * Verifica que a imagem REALMENTE carregou.
   *
   * `toBeVisible()` passaria com um `src` quebrado — o elemento existe e ocupa espaço.
   * `naturalWidth > 0` só é verdade se o navegador decodificou o arquivo.
   */
  async expectImageLoaded(): Promise<void> {
    await expect(this.image).toBeVisible()

    const naturalWidth = await this.image.evaluate((img) => (img as HTMLImageElement).naturalWidth)

    expect(naturalWidth, 'a imagem existe no DOM mas não foi carregada').toBeGreaterThan(0)
  }

  async relatedProductCount(): Promise<number> {
    return this.byTestId('product-related').getByTestId('product-card').count()
  }
}
