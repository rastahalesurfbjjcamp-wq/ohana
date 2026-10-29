import { Header, Panel } from "@/components/ui";

const INFO: Record<string, { title: string; text: string; items: string[] }> = {
  lancamento: { title: "Lançamento", text: "Linha do tempo do drop, do aquecimento à abertura do carrinho, com mensagens programadas nos grupos.", items: ["Contagem regressiva e etapas do lançamento", "Mensagens automáticas em cada etapa", "Vendas do drop em tempo real"] },
  funis: { title: "Funis", text: "Sequências de mensagens no privado a partir de um gatilho (entrou no grupo, virou lead, comprou).", items: ["Construtor de etapas com espera", "Gatilhos por evento", "Taxa de conversão por funil"] },
  recuperacao: { title: "Recuperação", text: "Mensagem automática no WhatsApp para carrinho abandonado, Pix gerado e não pago, cartão recusado e atualização de rastreio.", items: ["Carrinho abandonado", "Pix e boleto pendentes", "Cartão recusado", "Rastreio do pedido"] },
  entregas: { title: "Entregas", text: "Todos os envios com status, prazo e atraso, puxando o rastreio da Olist.", items: ["Pedidos atrasados", "Aviso automático ao cliente", "Prazo médio por transportadora"] },
  atendimento: { title: "Atendimento", text: "Caixa de conversas do WhatsApp da loja, com etiquetas e respostas rápidas.", items: ["Conversas em um só lugar", "Respostas rápidas", "Histórico do cliente ao lado"] },
  assistente: { title: "Assistente IA", text: "IA que responde dúvidas de tamanho, prazo e troca no WhatsApp, com os dados reais da loja.", items: ["Tabela de medidas e estoque", "Prazo de entrega", "Passa para humano quando precisa"] },
  "pos-venda": { title: "Pós-venda", text: "Depois da compra: pedido de avaliação com foto, cashback para a próxima compra e oferta complementar.", items: ["Avaliação com foto", "Cashback", "Oferta pós-compra", "Voucher de aniversário"] },
  indique: { title: "Indique e ganhe", text: "Cada cliente ganha um link; quem indica e quem compra ganham desconto.", items: ["Link por cliente", "Cupom automático", "Ranking de quem mais indica"] },
  campanhas: { title: "Campanhas", text: "Desempenho das campanhas de anúncio com o que o Meta diz e o que a UTM confirma.", items: ["Gasto, vendas e ROAS por campanha", "Criativos que mais vendem", "Alertas de campanha cara"] },
  diagnostico: { title: "Diagnóstico com IA", text: "A IA olha conversão, anúncios, estoque e preço e diz o que fazer primeiro.", items: ["Problemas em ordem de impacto", "Plano de ação da semana", "Comparação com o mês anterior"] },
};

export default async function EmBreve({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = INFO[slug] ?? { title: "Em construção", text: "Esta parte ainda está sendo feita.", items: [] };
  return (
    <>
      <Header title={info.title} lede={info.text} />
      <Panel title="Em construção" sub="Esta parte entra na próxima leva de atualizações do sistema.">
        <ul className="stack" style={{ gap: 8, paddingLeft: 18 }}>
          {info.items.map((i) => <li key={i} className="mut">{i}</li>)}
        </ul>
      </Panel>
    </>
  );
}
