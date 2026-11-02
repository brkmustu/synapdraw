# Katkıda Bulunma (Contributing)

SynapDraw projesine katkıda bulunmak için:

1. Yeni özellik veya hata düzeltmeleri için ilgili dal (`feature/*` veya `fix/*`) üzerinden çalışma başlatın.
2. Değişikliklerinizi göndermeden önce tip denetimi ve testleri çalıştırın:
   ```bash
   yarn test:typecheck
   yarn test:app
   yarn fix
   ```
3. Mimari kararlar ve SDLC yüzey standartları için [`docs/sdlc_superapp_plan.md`](./docs/sdlc_superapp_plan.md) dokümanını inceleyin.
