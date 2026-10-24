# Links

Uma página única e minimalista para guardar os sites que você mais usa no dia a dia.
Self-hosted: os dados ficam num arquivo SQLite no seu servidor, então aparecem em
qualquer dispositivo da sua rede.

Sem tags, sem pastas, sem login, sem busca. Só nome + URL.

## Funcionalidades

- Botão **+** para adicionar um site (nome e URL)
- Cards clicáveis que abrem o link em nova aba
- Botão **×** em cada card para remover
- Modo escuro automático (segue o sistema)
- Engrenagem **⚙** com painel de aparência: tema (sistema/claro/escuro), fundos
  prontos (cores e degradês) ou cor personalizada. Fica salvo no navegador.
- Layout responsivo para celular

## Como rodar

### Com Podman (recomendado)

Com `podman-compose` (ou `podman compose`, que usa o provider instalado):

```bash
podman-compose up -d --build
```

Ou sem compose:

```bash
podman build -t links .
podman run -d --name links \
  -p 5000:5000 \
  -v ./data:/app/data:Z \
  --userns=keep-id:uid=1000,gid=1000 \
  --restart=unless-stopped \
  links
```

Acesse `http://localhost:5000` ou, de outro dispositivo, `http://IP-DO-SERVIDOR:5000`.

O banco fica em `./data/links.db` (montado como volume), então sobrevive a
atualizações e recriações do container.

**Notas sobre o Podman rootless:**

- `--userns=keep-id:uid=1000,gid=1000` (ou `userns_mode` no compose) mapeia seu
  usuário para o usuário `app` do container. Sem isso, o app não consegue gravar
  em `data/`. Requer Podman 4.3+.
- `:Z` é necessário em sistemas com SELinux (Fedora, RHEL); nos demais não faz nada.
- Para o container voltar sozinho após reiniciar a máquina:

  ```bash
  systemctl --user enable --now podman-restart.service
  loginctl enable-linger "$USER"   # mantém seus serviços rodando sem login
  ```

- Se o firewall bloquear o acesso pela rede, libere a porta (ex.: no Fedora,
  `sudo firewall-cmd --add-port=5000/tcp --permanent && sudo firewall-cmd --reload`).

### Com Docker

O `docker-compose.yml` usa `userns_mode: keep-id`, que é exclusivo do Podman.
Para usar Docker, remova essa linha e rode `docker compose up -d --build`.

### Sem Docker (desenvolvimento)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

A tabela é criada automaticamente na primeira execução.

## Configuração

| Variável   | Padrão          | Descrição                     |
|------------|-----------------|-------------------------------|
| `LINKS_DB` | `data/links.db` | Caminho do arquivo SQLite     |
| `PORT`     | `5000`          | Porta (apenas em `python app.py`) |

Para mudar a porta no Docker, altere o lado esquerdo em `docker-compose.yml`
(ex.: `"8080:5000"`).

## API

| Método   | Rota              | Descrição                         | Respostas        |
|----------|-------------------|-----------------------------------|------------------|
| `GET`    | `/api/links`      | Lista todos os links              | `200`            |
| `POST`   | `/api/links`      | Cria um link (`{"name", "url"}`)  | `201`, `400`     |
| `DELETE` | `/api/links/<id>` | Remove um link                    | `204`, `404`     |

Erros retornam JSON no formato `{"error": "mensagem"}`.

```bash
curl -X POST http://localhost:5000/api/links \
  -H "Content-Type: application/json" \
  -d '{"name": "GitHub", "url": "https://github.com"}'
```

## Obs:

- Validação no backend: nome (até 100 caracteres) e URL (até 2048) obrigatórios;
  só são aceitas URLs `http://` e `https://`.
- Todas as queries SQL são parametrizadas.
- O frontend monta os cards com `textContent`, nunca `innerHTML`.


