# PIMO Models Temp

Este diretório contém modelos 3D temporários para o projeto PIMO.

## Estrutura de Diretórios

```
pimo-models-temp/
├── kitchen/           # Modelos de cozinha
│   ├── base/         # Modelos de base de cozinha
│   └── upper/        # Modelos de armários superiores
└── wardrobe/         # Modelos de guarda-roupa
    ├── lower/        # Modelos de guarda-roupa inferior
    └── upper/        # Modelos de guarda-roupa superior
```

## Modelos Disponíveis

### Cozinha - Base
- `base_20cm.js` - Base de cozinha 20cm largura
- `base_30cm.js` - Base de cozinha 30cm largura
- `base_40cm.js` - Base de cozinha 40cm largura
- `base_50cm.js` - Base de cozinha 50cm largura
- `base_60cm.js` - Base de cozinha 60cm largura
- `base_70cm.js` - Base de cozinha 70cm largura
- `base_80cm.js` - Base de cozinha 80cm largura
- `base_90cm.js` - Base de cozinha 90cm largura
- `base_100cm.js` - Base de cozinha 100cm largura

### Cozinha - Superior
- `upper_25d_20cm.js` - Armário superior 25cm profundidade, 20cm largura
- `upper_25d_30cm.js` - Armário superior 25cm profundidade, 30cm largura
- `upper_25d_40cm.js` - Armário superior 25cm profundidade, 40cm largura
- `upper_25d_50cm.js` - Armário superior 25cm profundidade, 50cm largura
- `upper_25d_60cm.js` - Armário superior 25cm profundidade, 60cm largura
- `upper_25d_70cm.js` - Armário superior 25cm profundidade, 70cm largura
- `upper_25d_80cm.js` - Armário superior 25cm profundidade, 80cm largura
- `upper_25d_90cm.js` - Armário superior 25cm profundidade, 90cm largura
- `upper_25d_100cm.js` - Armário superior 25cm profundidade, 100cm largura
- `upper_35d_20cm.js` - Armário superior 35cm profundidade, 20cm largura
- `upper_35d_30cm.js` - Armário superior 35cm profundidade, 30cm largura
- `upper_35d_40cm.js` - Armário superior 35cm profundidade, 40cm largura
- `upper_35d_50cm.js` - Armário superior 35cm profundidade, 50cm largura
- `upper_35d_60cm.js` - Armário superior 35cm profundidade, 60cm largura
- `upper_35d_70cm.js` - Armário superior 35cm profundidade, 70cm largura
- `upper_35d_80cm.js` - Armário superior 35cm profundidade, 80cm largura
- `upper_35d_90cm.js` - Armário superior 35cm profundidade, 90cm largura
- `upper_35d_100cm.js` - Armário superior 35cm profundidade, 100cm largura

### Guarda-roupa - Inferior
- `lower_60cm.js` - Guarda-roupa inferior 60cm largura
- `lower_70cm.js` - Guarda-roupa inferior 70cm largura
- `lower_80cm.js` - Guarda-roupa inferior 80cm largura
- `lower_90cm.js` - Guarda-roupa inferior 90cm largura
- `lower_100cm.js` - Guarda-roupa inferior 100cm largura
- `lower_110cm.js` - Guarda-roupa inferior 110cm largura
- `lower_120cm.js` - Guarda-roupa inferior 120cm largura

### Guarda-roupa - Superior
- `upper_60cm.js` - Guarda-roupa superior 60cm largura
- `upper_70cm.js` - Guarda-roupa superior 70cm largura
- `upper_80cm.js` - Guarda-roupa superior 80cm largura
- `upper_90cm.js` - Guarda-roupa superior 90cm largura
- `upper_100cm.js` - Guarda-roupa superior 100cm largura
- `upper_110cm.js` - Guarda-roupa superior 110cm largura
- `upper_120cm.js` - Guarda-roupa superior 120cm largura

## Formato dos Modelos

Cada arquivo JavaScript contém:

- **metadata**: Informações sobre o modelo (nome, categoria, descrição, dimensões padrão)
- **generateParts(dim)**: Função que gera as peças da caixa com base nas dimensões fornecidas
- **generate3D(dim)**: Função que gera a estrutura 3D pronta para renderização
- **getRules()**: Função que retorna as regras de dimensionamento (altura, largura, profundidade mínima/máxima)

## Espessuras Padrão

- **Laterais, base e topo**: 19mm
- **Costas**: 10mm

## Uso

Estes modelos podem ser importados e utilizados no viewer 3D do PIMO para visualização e montagem de projetos de marcenaria.

## Observações

- Este é um diretório temporário para desenvolvimento e testes
- Os modelos podem ser movidos para um diretório permanente no futuro
- Cada modelo inclui regras de dimensionamento para garantir a compatibilidade com os padrões de produção