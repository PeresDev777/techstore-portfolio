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
  private get addButton(): Locator {
    return this.byTestId('product-detail-add-to-cart')
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

  async expectAddButtonDisabled(): Promise<void> {
    await expect(this.addButton).toBeDisabled()
  }

  async expectAddButtonHidden(): Promise<void> {
    await expect(this.addButton).toBeHidden()
  }

  async expectIncreaseDisabled(): Promise<void> {
    await expect(this.byTestId('quantity-increase')).toBeDisabled()
  }

  /**
   * Confere os dados exibidos contra a massa de teste.
   *
   * Um único método em vez de cinco asserções repetidas em cada spec: quando um campo
   * novo entrar na página, há um só lugar para atualizar.
   */
  async expectProductDetails(product: TestProduct): Promise<void> {
    await expect(this.name).toHaveText(product.name)
    await expect(this.price).toHaveText(formatCents(product.price))
    await expect(this.category).toHaveText(product.category)
    await expect(this.rating).toContainText(product.rating.toString().replace('.', ','))
    expect(await readCents(this.price)).toBe(product.price)
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

  async expectOutOfStock(): Promise<void> {
    await expect(this.stock).toContainText('esgotado')
  }

  async relatedProductCount(): Promise<number> {
    return this.byTestId('product-related').getByTestId('product-card').count()
  }
}
