# Palavra & Notas

PWA (app web instalável) com Bíblia bilíngue Português/Inglês offline e anotações de sermões e cultos.

## Rodar localmente

```bash
python -m http.server 8765
```

Acesse http://localhost:8765. Para testar no celular na mesma rede Wi-Fi, use o IP do computador
(ex.: `http://192.168.0.10:8765`) — mas a instalação como app e o modo offline só funcionam em
`localhost` ou HTTPS. Para usar de verdade no celular, publique em um host HTTPS gratuito
(GitHub Pages, Netlify, Cloudflare Pages) e use "Adicionar à tela inicial".

## Funcionalidades

- **Bíblia**: modos intercalado, lado a lado, só PT, só EN; troca de capítulo por botões ou deslizando;
  seletor de livro/capítulo com filtro ou referência digitada (Jo 3:16, Psalm 23); marcação em 4 cores;
  copiar versículos nas duas línguas; enviar versículos para uma anotação.
- **Anotações**: tipo (culto, sermão, estudo, célula...), título, data, pregador, igreja, texto base com
  pré-visualização, tópicos numerados (reordenar/remover com desfazer), versículos citados com texto PT/EN,
  anotações livres, aplicação pessoal, pedidos de oração, marcadores. Salvamento automático,
  busca e filtro, compartilhar como texto.
- **Gravação de voz** (dentro da anotação): gravar, pausar e parar, inclusive navegando pela Bíblia
  (indicador "Gravando" no topo). Tópicos adicionados durante a gravação ganham um botão "▶ mm:ss" que
  toca o áudio a partir daquele momento. Áudios ficam no IndexedDB (~21 MB/hora); podem ser
  compartilhados/salvos como arquivo. Exige HTTPS e permissão de microfone; a tela fica ligada
  durante a gravação (Wake Lock), pois muitos celulares interrompem o microfone com a tela bloqueada.
- **Exportar**: anotação em PDF (A4, versículos PT/EN lado a lado, tópicos numerados) via "Salvar como PDF" do sistema, ou como texto.
- **Busca**: por referência ou palavra (sem diferenciar acentos) em PT, EN ou nas anotações.
- **Ajustes**: versão PT, tamanho da letra, tema claro/escuro, backup (exportar/importar JSON).

Os dados do usuário ficam no `localStorage` do aparelho — exporte o backup periodicamente.

## Estrutura

```
index.html            telas e barra de abas
css/app.css           estilos (claro/escuro)
js/books.js           livros, versões e leitura de referências
js/recorder.js        gravador de voz e armazenamento dos áudios (IndexedDB)
js/app.js             leitor, anotações, gravação (interface), busca, ajustes
sw.js                 service worker (offline) — aumente VERSION ao alterar o app
data/*.json           textos: [livro][capítulo][versículo]
```

## Textos bíblicos

| Arquivo | Versão | Licença |
|---|---|---|
| `data/bpm.json` | Bíblia Portuguesa Mundial | Domínio público (eBible.org) |
| `data/blivre.json` | Bíblia Livre (2018) | CC BY 4.0 Brasil — © Diego Santos, Mario Sérgio e Marco Teles |
| `data/web.json` | World English Bible | Domínio público (eBible.org); o nome é marca de eBible.org |

Gerados a partir dos arquivos VPL de https://ebible.org/Scriptures/ (apenas os 66 livros canônicos).
NVI, ARA, NAA, NIV etc. exigem licença das editoras para serem incluídas.
