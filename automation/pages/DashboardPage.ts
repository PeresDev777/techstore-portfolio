import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import { HeaderComponent } from '@pages/components/HeaderComponent'
import { ROUTES } from '@utils/routes'

export class DashboardPage extends BasePage {
  protected readonly path = ROUTES.dashboard
  protected readonly readyLocator: Locator = this.byTestId('dashboard-title')

  readonly header = new HeaderComponent(this.page)

  async expectGreeting(name: string): Promise<void> {
    await expect(this.readyLocator).toContainText(name)
  }

  /** Atalhos por categoria levam à listagem já filtrada. */
  async openCategory(category: string): Promise<void> {
    await this.byTestId('dashboard-category-link').filter({ hasText: category }).click()
  }

  async openAllProducts(): Promise<void> {
    await this.byTestId('dashboard-see-all').click()
  }
}
