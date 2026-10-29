// Nomes em português das métricas que o Meta manda
const L: Record<string, string> = {
  instagram_profile_visits: "Visitas ao perfil do Instagram",
  instagram_profile_visit: "Visitas ao perfil do Instagram",
  link_click: "Cliques no link",
  landing_page_view: "Visualizações da página",
  post_engagement: "Engajamento com o post",
  page_engagement: "Engajamento com a página",
  post_reaction: "Reações",
  comment: "Comentários",
  post: "Compartilhamentos",
  like: "Curtidas na página do Facebook",
  video_view: "Visualizações do vídeo",
  "onsite_conversion.post_save": "Salvamentos",
  "onsite_conversion.messaging_conversation_started_7d": "Conversas iniciadas (Direct/WhatsApp)",
  "onsite_conversion.messaging_first_reply": "Primeira resposta na conversa",
  "onsite_conversion.total_messaging_connection": "Conexões de mensagem",
  "onsite_conversion.messaging_user_depth_2_message_send": "Conversas com 2+ mensagens",
  "onsite_conversion.messaging_user_depth_3_message_send": "Conversas com 3+ mensagens",
  "onsite_conversion.messaging_welcome_message_view": "Mensagem de boas-vindas vista",
  omni_purchase: "Compras",
  lead: "Leads",
};
export const metaLabel = (k: string) => L[k] ?? (/follow/.test(k) ? `Seguidores (${k})` : k);
