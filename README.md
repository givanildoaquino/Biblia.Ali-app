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

Interface no estilo Material Design 3, com tema claro e escuro. Abas: **Notas | Bíblia | Pesquisa | Ajustes**.

- **Notas** (tela inicial): cards de resumo com tipo, data, título, pregador, texto base e um trecho;
  filtro por tipo; botão "Nova nota".
- **Editor**: título, tipo, detalhes recolhíveis (pregador, data, local, texto base, marcadores) e
  texto formatado. A barra acima do teclado tem negrito, itálico, lista, lista numerada, título de
  seção e **Inserir Bíblia** (insere o versículo com texto PT/EN). Salva automaticamente.
- **Gravação de voz**: botão de microfone no editor; gravar, pausar e parar, inclusive navegando pela
  Bíblia (indicador "Gravando" no topo). Cada parágrafo escrito durante a gravação ganha um selo
  "▶ mm:ss" que toca o áudio daquele momento. Áudios ficam no IndexedDB (~21 MB/hora). Exige HTTPS e
  permissão de microfone; a tela fica ligada durante a gravação (Wake Lock).
- **Bíblia**: modos intercalado, lado a lado, só PT, só EN; troca de capítulo por botões ou deslizando;
  seletor de livro/capítulo com filtro ou referência digitada (Jo 3:16, Psalm 23); marcação em 4 cores;
  copiar versículos nas duas línguas; enviar versículos para uma nota.
- **Exportar**: nota em PDF (A4, versículos PT/EN lado a lado, tópicos numerados) via "Salvar como PDF"
  do sistema, ou como texto.
- **Pesquisa**: por referência ou palavra (sem diferenciar acentos) em PT, EN ou nas notas.
- **Ajustes**: modo de leitura, versão PT, tamanho da letra, tema, backup (exportar/importar JSON).

Os dados do usuário ficam no aparelho (`localStorage` e IndexedDB) — exporte o backup periodicamente.
O conteúdo da nota é guardado como HTML restrito (`p`, `b`, `i`, `ul`, `ol`, `li`, `h3` e
`blockquote data-ref` para versículos); notas do formato antigo são convertidas ao abrir o app.

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
