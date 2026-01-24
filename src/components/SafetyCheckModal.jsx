import React from 'react';

/**
 * SafetyCheckModal Component
 * 
 * Trauma-informed "safe space" verification before enabling voice features.
 * Ensures the veteran is in a private, comfortable environment.
 */
const SafetyCheckModal = ({
  isOpen = false,
  onConfirm,
  onCancel,
  language = 'en',
  className = ''
}) => {
  // Localized content
  const content = {
    en: {
      title: "🔐 Check Your Surroundings",
      description: "We're about to discuss your service and medical history. To keep your story private and your mind at ease, please confirm:",
      checkpoints: [
        "I am in a private place where others won't overhear",
        "I feel grounded and ready to talk about my claim",
        "I know I can stop this conversation at any time"
      ],
      tip: "Tip: Triple-tap the 'Esc' key at any time to instantly hide this app.",
      confirmBtn: "I'm in a safe place, let's start",
      cancelBtn: "Not right now, maybe later"
    },
    es: {
      title: "🔐 Verifica Tu Entorno",
      description: "Vamos a discutir tu historial de servicio y médico. Para mantener tu historia privada y tu mente tranquila, por favor confirma:",
      checkpoints: [
        "Estoy en un lugar privado donde otros no pueden escuchar",
        "Me siento centrado y listo para hablar sobre mi reclamo",
        "Sé que puedo detener esta conversación en cualquier momento"
      ],
      tip: "Consejo: Presiona 'Esc' tres veces para ocultar esta app instantáneamente.",
      confirmBtn: "Estoy en un lugar seguro, comencemos",
      cancelBtn: "Ahora no, tal vez después"
    },
    tl: {
      title: "🔐 Suriin ang Iyong Paligid",
      description: "Pag-uusapan natin ang iyong kasaysayan ng serbisyo at medikal. Para mapanatiling pribado ang iyong kwento, pakikumpirma:",
      checkpoints: [
        "Nasa pribadong lugar ako kung saan hindi ako maririnig ng iba",
        "Handa akong pag-usapan ang aking claim",
        "Alam ko na maaari kong ihinto ang usapang ito anumang oras"
      ],
      tip: "Tip: I-tap ng tatlo ang 'Esc' key para agad na itago ang app na ito.",
      confirmBtn: "Nasa ligtas na lugar ako, simulan natin",
      cancelBtn: "Hindi ngayon, siguro mamaya"
    },
    vi: {
      title: "🔐 Kiểm Tra Môi Trường Xung Quanh",
      description: "Chúng ta sẽ thảo luận về lịch sử phục vụ và y tế của bạn. Để giữ câu chuyện của bạn riêng tư, vui lòng xác nhận:",
      checkpoints: [
        "Tôi đang ở nơi riêng tư, nơi người khác không thể nghe thấy",
        "Tôi cảm thấy sẵn sàng để nói về yêu cầu của mình",
        "Tôi biết tôi có thể dừng cuộc trò chuyện này bất cứ lúc nào"
      ],
      tip: "Mẹo: Nhấn phím 'Esc' ba lần để ẩn ứng dụng này ngay lập tức.",
      confirmBtn: "Tôi đang ở nơi an toàn, bắt đầu thôi",
      cancelBtn: "Không phải bây giờ, có thể sau"
    },
    ko: {
      title: "🔐 주변 환경을 확인하세요",
      description: "귀하의 복무 및 의료 기록에 대해 이야기하겠습니다. 귀하의 이야기를 비공개로 유지하려면 다음을 확인해 주세요:",
      checkpoints: [
        "다른 사람이 들을 수 없는 개인 공간에 있습니다",
        "청구에 대해 이야기할 준비가 되어 있습니다",
        "언제든지 이 대화를 중단할 수 있다는 것을 알고 있습니다"
      ],
      tip: "팁: 'Esc' 키를 세 번 탭하여 즉시 이 앱을 숨깁니다.",
      confirmBtn: "안전한 장소에 있습니다, 시작합시다",
      cancelBtn: "지금은 안 됩니다"
    }
  };
  
  const c = content[language] || content.en;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className={`max-w-md bg-slate-900 border-2 border-yellow-500/50 rounded-xl p-6 shadow-2xl ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{c.title}</h2>
        
        <p className="text-slate-300 mb-6 leading-relaxed">
          {c.description}
        </p>
        
        <ul className="space-y-3 mb-8">
          {c.checkpoints.map((point, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        
        {/* Tip Box */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-6 border border-slate-700">
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-blue-400">💡</span>
            <span>{c.tip}</span>
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20"
          >
            {c.confirmBtn}
          </button>
          
          <button
            onClick={onCancel}
            className="w-full bg-transparent border border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 py-2.5 rounded-lg transition-colors"
          >
            {c.cancelBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafetyCheckModal;
