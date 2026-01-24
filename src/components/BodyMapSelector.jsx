/**
 * BodyMapSelector - Interactive Visual Pain Map
 * "The Somatic Target" - Translates physical pain locations into medical terminology
 * 
 * The Problem: Veterans write "My back hurts" and get rated 10%
 * The Solution: Click-based medical translation system
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const BodyMapSelector = ({ onSymptomUpdate, existingSymptoms = [], onLogToSymptomLogger, onClose }) => {
  const { t } = useLanguage();
  const [view, setView] = useState('front'); // 'front' or 'back'
  const [selectedZone, setSelectedZone] = useState(null);
  const [symptoms, setSymptoms] = useState(existingSymptoms);
  const [activeZones, setActiveZones] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState('musculoskeletal'); // Category filter

  // Comprehensive Body zones with their medical translations - ALL body systems
  const BODY_ZONES = {
    // ============ MUSCULOSKELETAL SYSTEM ============
    head: {
      name: 'Head/Skull',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Headaches': 'recurrent cephalgia',
        'Migraines': 'migraine disorder with aura',
        'Dizziness': 'chronic vertigo/vestibular dysfunction',
        'TBI Symptoms': 'post-concussive syndrome',
        'Sinus Pain': 'chronic sinusitis with facial tenderness',
        'TMJ Pain': 'temporomandibular joint dysfunction',
        'Jaw Locking': 'temporomandibular joint disorder with limited opening',
      }
    },
    neck: {
      name: 'Cervical Spine/Neck',
      category: 'musculoskeletal',
      symptoms: {
        'Stiffness': 'limited cervical range of motion',
        'Shooting Pain to Arms': 'cervical radiculopathy with bilateral upper extremity paresthesia',
        'Chronic Pain': 'chronic cervicalgia',
        'Locking/Catching': 'degenerative cervical joint disease with mechanical symptoms',
        'Muscle Spasms': 'cervical paraspinal muscle spasm',
        'Grinding/Crepitus': 'cervical degenerative disc disease with crepitus',
      }
    },
    shoulder_left: {
      name: 'Left Shoulder',
      category: 'musculoskeletal',
      symptoms: {
        'Rotator Cuff Pain': 'left rotator cuff tendinopathy/tear',
        'Limited ROM': 'limited left shoulder abduction and flexion',
        'Popping/Clicking': 'left glenohumeral joint instability',
        'Chronic Pain': 'chronic left shoulder pain syndrome',
        'Frozen Shoulder': 'left adhesive capsulitis',
        'Impingement': 'left shoulder impingement syndrome',
      }
    },
    shoulder_right: {
      name: 'Right Shoulder',
      category: 'musculoskeletal',
      symptoms: {
        'Rotator Cuff Pain': 'right rotator cuff tendinopathy/tear',
        'Limited ROM': 'limited right shoulder abduction and flexion',
        'Popping/Clicking': 'right glenohumeral joint instability',
        'Chronic Pain': 'chronic right shoulder pain syndrome',
        'Frozen Shoulder': 'right adhesive capsulitis',
        'Impingement': 'right shoulder impingement syndrome',
      }
    },
    elbow_left: {
      name: 'Left Elbow',
      category: 'musculoskeletal',
      symptoms: {
        'Tennis Elbow': 'left lateral epicondylitis',
        'Golfers Elbow': 'left medial epicondylitis',
        'Chronic Pain': 'left elbow degenerative joint disease',
        'Limited ROM': 'limited left elbow flexion/extension',
        'Numbness in Hand': 'left cubital tunnel syndrome',
      }
    },
    elbow_right: {
      name: 'Right Elbow',
      category: 'musculoskeletal',
      symptoms: {
        'Tennis Elbow': 'right lateral epicondylitis',
        'Golfers Elbow': 'right medial epicondylitis',
        'Chronic Pain': 'right elbow degenerative joint disease',
        'Limited ROM': 'limited right elbow flexion/extension',
        'Numbness in Hand': 'right cubital tunnel syndrome',
      }
    },
    wrist_left: {
      name: 'Left Wrist/Hand',
      category: 'musculoskeletal',
      symptoms: {
        'Carpal Tunnel': 'left carpal tunnel syndrome',
        'Chronic Pain': 'left wrist degenerative joint disease',
        'Numbness/Tingling': 'left upper extremity peripheral neuropathy',
        'Grip Weakness': 'left hand grip strength deficit',
        'Trigger Finger': 'left stenosing tenosynovitis',
        'De Quervains': 'left de Quervain tenosynovitis',
      }
    },
    wrist_right: {
      name: 'Right Wrist/Hand',
      category: 'musculoskeletal',
      symptoms: {
        'Carpal Tunnel': 'right carpal tunnel syndrome',
        'Chronic Pain': 'right wrist degenerative joint disease',
        'Numbness/Tingling': 'right upper extremity peripheral neuropathy',
        'Grip Weakness': 'right hand grip strength deficit',
        'Trigger Finger': 'right stenosing tenosynovitis',
        'De Quervains': 'right de Quervain tenosynovitis',
      }
    },
    upper_back: {
      name: 'Thoracic Spine/Upper Back',
      category: 'musculoskeletal',
      symptoms: {
        'Muscle Spasms': 'thoracic paraspinal muscle spasm',
        'Chronic Pain': 'chronic thoracic spine pain',
        'Breathing Difficulty': 'costovertebral dysfunction',
        'Postural Pain': 'thoracic kyphosis with chronic pain',
        'Rib Pain': 'costochondritis/intercostal neuralgia',
      }
    },
    lower_back: {
      name: 'Lumbar Spine/Lower Back',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'chronic lumbar radiculopathy',
        'Shooting Pain Down Legs': 'lumbar radiculopathy with bilateral lower extremity paresthesia',
        'Stiffness': 'limited lumbar flexion/extension with morning stiffness',
        'Locking Up': 'lumbar facet joint syndrome',
        'Sciatic Pain': 'sciatica with nerve root compression',
        'Disc Herniation': 'lumbar intervertebral disc herniation',
        'Spinal Stenosis': 'lumbar spinal stenosis with neurogenic claudication',
      }
    },
    hip_left: {
      name: 'Left Hip',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'left hip degenerative joint disease',
        'Limited ROM': 'limited left hip flexion/rotation',
        'Popping': 'left hip labral tear',
        'Groin Pain': 'left hip impingement syndrome',
        'Bursitis': 'left trochanteric bursitis',
      }
    },
    hip_right: {
      name: 'Right Hip',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'right hip degenerative joint disease',
        'Limited ROM': 'limited right hip flexion/rotation',
        'Popping': 'right hip labral tear',
        'Groin Pain': 'right hip impingement syndrome',
        'Bursitis': 'right trochanteric bursitis',
      }
    },
    knee_left: {
      name: 'Left Knee',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'left knee degenerative joint disease',
        'Instability': 'left knee ligamentous instability',
        'Locking/Catching': 'left knee meniscal tear with mechanical symptoms',
        'Swelling': 'chronic left knee effusion',
        'Patella Pain': 'left patellofemoral syndrome',
        'Giving Way': 'left ACL insufficiency',
      }
    },
    knee_right: {
      name: 'Right Knee',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'right knee degenerative joint disease',
        'Instability': 'right knee ligamentous instability',
        'Locking/Catching': 'right knee meniscal tear with mechanical symptoms',
        'Swelling': 'chronic right knee effusion',
        'Patella Pain': 'right patellofemoral syndrome',
        'Giving Way': 'right ACL insufficiency',
      }
    },
    ankle_left: {
      name: 'Left Ankle/Foot',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'left ankle chronic pain/instability',
        'Limited ROM': 'limited left ankle dorsiflexion/plantarflexion',
        'Plantar Fasciitis': 'chronic left plantar fasciitis',
        'Achilles Pain': 'left Achilles tendinopathy',
        'Bone Spurs': 'left calcaneal enthesophyte',
        'Flat Feet': 'left pes planus with pain',
      }
    },
    ankle_right: {
      name: 'Right Ankle/Foot',
      category: 'musculoskeletal',
      symptoms: {
        'Chronic Pain': 'right ankle chronic pain/instability',
        'Limited ROM': 'limited right ankle dorsiflexion/plantarflexion',
        'Plantar Fasciitis': 'chronic right plantar fasciitis',
        'Achilles Pain': 'right Achilles tendinopathy',
        'Bone Spurs': 'right calcaneal enthesophyte',
        'Flat Feet': 'right pes planus with pain',
      }
    },

    // ============ CARDIOVASCULAR SYSTEM ============
    heart: {
      name: 'Heart/Cardiovascular',
      category: 'cardiovascular',
      symptoms: {
        'Chest Pain': 'angina pectoris/coronary artery disease',
        'Palpitations': 'cardiac arrhythmia',
        'Shortness of Breath': 'dyspnea on exertion secondary to cardiac condition',
        'High Blood Pressure': 'hypertension requiring medication',
        'Heart Murmur': 'valvular heart disease',
        'Leg Swelling': 'peripheral edema secondary to cardiac insufficiency',
        'Irregular Heartbeat': 'atrial fibrillation/flutter',
      }
    },
    circulation: {
      name: 'Peripheral Circulation',
      category: 'cardiovascular',
      symptoms: {
        'Cold Extremities': 'peripheral vascular disease',
        'Leg Pain Walking': 'intermittent claudication',
        'Varicose Veins': 'chronic venous insufficiency',
        'Blood Clots History': 'deep vein thrombosis/pulmonary embolism history',
        'Poor Wound Healing': 'arterial insufficiency',
      }
    },

    // ============ RESPIRATORY SYSTEM ============
    lungs: {
      name: 'Lungs/Respiratory',
      category: 'respiratory',
      symptoms: {
        'Chronic Cough': 'chronic bronchitis',
        'Shortness of Breath': 'chronic obstructive pulmonary disease (COPD)',
        'Wheezing': 'reactive airway disease/asthma',
        'Sleep Apnea': 'obstructive sleep apnea requiring CPAP',
        'Reduced Lung Capacity': 'restrictive lung disease',
        'Exposure-Related': 'pulmonary disease secondary to environmental/burn pit exposure',
      }
    },

    // ============ DIGESTIVE SYSTEM ============
    stomach: {
      name: 'Stomach/Upper GI',
      category: 'digestive',
      symptoms: {
        'Acid Reflux': 'gastroesophageal reflux disease (GERD)',
        'Ulcers': 'peptic ulcer disease',
        'Nausea': 'chronic nausea and vomiting',
        'Bloating': 'functional dyspepsia',
        'Difficulty Swallowing': 'dysphagia/esophageal stricture',
        'Hiatal Hernia': 'hiatal hernia with reflux',
      }
    },
    intestines: {
      name: 'Intestines/Lower GI',
      category: 'digestive',
      symptoms: {
        'IBS': 'irritable bowel syndrome',
        'Chronic Diarrhea': 'chronic diarrhea/malabsorption',
        'Constipation': 'chronic constipation requiring medication',
        'Crohns/Colitis': 'inflammatory bowel disease',
        'Hemorrhoids': 'chronic hemorrhoids with bleeding',
        'Diverticulitis': 'diverticular disease',
      }
    },
    liver: {
      name: 'Liver/Gallbladder',
      category: 'digestive',
      symptoms: {
        'Fatty Liver': 'non-alcoholic fatty liver disease',
        'Hepatitis': 'chronic hepatitis',
        'Gallstones': 'cholelithiasis with chronic symptoms',
        'Elevated Enzymes': 'chronic liver enzyme elevation',
      }
    },

    // ============ GENITOURINARY SYSTEM ============
    kidney: {
      name: 'Kidneys/Urinary',
      category: 'genitourinary',
      symptoms: {
        'Kidney Stones': 'nephrolithiasis with recurrent episodes',
        'Chronic Kidney Disease': 'chronic kidney disease requiring monitoring',
        'Frequent UTIs': 'recurrent urinary tract infections',
        'Incontinence': 'urinary incontinence requiring management',
        'Enlarged Prostate': 'benign prostatic hyperplasia with urinary symptoms',
        'Painful Urination': 'chronic dysuria/interstitial cystitis',
      }
    },
    reproductive: {
      name: 'Reproductive System',
      category: 'genitourinary',
      symptoms: {
        'Erectile Dysfunction': 'erectile dysfunction',
        'Painful Periods': 'dysmenorrhea/endometriosis',
        'Infertility': 'infertility secondary to service-connected condition',
        'Testicular Pain': 'chronic orchialgia',
        'Pelvic Pain': 'chronic pelvic pain syndrome',
      }
    },

    // ============ NERVOUS SYSTEM ============
    brain: {
      name: 'Brain/Central Nervous System',
      category: 'neurological',
      symptoms: {
        'Memory Problems': 'cognitive impairment/mild neurocognitive disorder',
        'Seizures': 'seizure disorder/epilepsy',
        'TBI Effects': 'traumatic brain injury residuals',
        'Concentration Issues': 'attention deficit/executive dysfunction',
        'Speech Problems': 'dysarthria/aphasia',
        'Balance Problems': 'vestibular dysfunction/disequilibrium',
      }
    },
    peripheral_nerves: {
      name: 'Peripheral Nerves',
      category: 'neurological',
      symptoms: {
        'Numbness Hands/Feet': 'peripheral neuropathy bilateral extremities',
        'Burning Sensations': 'small fiber neuropathy',
        'Nerve Pain': 'neuralgia/neuropathic pain syndrome',
        'Weakness': 'peripheral nerve injury with motor deficit',
        'Radiculopathy': 'cervical/lumbar radiculopathy',
      }
    },

    // ============ MENTAL HEALTH ============
    mental_health: {
      name: 'Mental Health',
      category: 'mental_health',
      symptoms: {
        'PTSD': 'post-traumatic stress disorder',
        'Depression': 'major depressive disorder',
        'Anxiety': 'generalized anxiety disorder',
        'Panic Attacks': 'panic disorder with agoraphobia',
        'Insomnia': 'chronic insomnia/sleep disorder',
        'Nightmares': 'nightmare disorder secondary to PTSD',
        'Hypervigilance': 'hyperarousal symptoms',
        'Social Isolation': 'social anxiety/avoidance behavior',
        'Anger Issues': 'intermittent explosive disorder/irritability',
        'Substance Use': 'substance use disorder secondary to mental health',
      }
    },

    // ============ SKIN CONDITIONS ============
    skin: {
      name: 'Skin/Dermatology',
      category: 'skin',
      symptoms: {
        'Chronic Rash': 'chronic dermatitis',
        'Eczema': 'atopic dermatitis',
        'Psoriasis': 'psoriasis vulgaris',
        'Scars': 'disfiguring scars/keloids',
        'Acne (Severe)': 'cystic acne/chloracne',
        'Skin Cancer': 'history of skin cancer requiring monitoring',
        'Hives': 'chronic urticaria',
        'Fungal Infections': 'chronic tinea/onychomycosis',
      }
    },

    // ============ EYES ============
    eyes: {
      name: 'Eyes/Vision',
      category: 'sensory',
      symptoms: {
        'Vision Loss': 'decreased visual acuity',
        'Double Vision': 'diplopia',
        'Dry Eyes': 'chronic dry eye syndrome',
        'Glaucoma': 'glaucoma requiring treatment',
        'Cataracts': 'cataracts affecting vision',
        'Light Sensitivity': 'photophobia/light sensitivity',
        'Floaters': 'vitreous floaters/posterior vitreous detachment',
        'Macular Degeneration': 'age-related macular degeneration',
      }
    },

    // ============ EARS ============
    ears: {
      name: 'Ears/Hearing',
      category: 'sensory',
      symptoms: {
        'Hearing Loss': 'sensorineural hearing loss bilateral',
        'Tinnitus': 'chronic tinnitus',
        'Ear Pain': 'chronic otalgia',
        'Balance Issues': 'vestibular dysfunction/Menieres disease',
        'Ear Infections': 'chronic otitis media/externa',
        'Hyperacusis': 'sound sensitivity/hyperacusis',
      }
    },

    // ============ ENDOCRINE SYSTEM ============
    thyroid: {
      name: 'Thyroid',
      category: 'endocrine',
      symptoms: {
        'Hypothyroid': 'hypothyroidism requiring medication',
        'Hyperthyroid': 'hyperthyroidism/Graves disease',
        'Thyroid Nodules': 'thyroid nodules requiring monitoring',
        'Fatigue': 'fatigue secondary to thyroid dysfunction',
        'Weight Changes': 'weight gain/loss secondary to thyroid',
      }
    },
    diabetes: {
      name: 'Diabetes/Blood Sugar',
      category: 'endocrine',
      symptoms: {
        'Type 2 Diabetes': 'diabetes mellitus type 2 requiring medication',
        'Type 1 Diabetes': 'diabetes mellitus type 1 insulin dependent',
        'Neuropathy from Diabetes': 'diabetic peripheral neuropathy',
        'Vision from Diabetes': 'diabetic retinopathy',
        'Kidney from Diabetes': 'diabetic nephropathy',
      }
    },

    // ============ IMMUNE SYSTEM ============
    immune: {
      name: 'Immune System',
      category: 'immune',
      symptoms: {
        'Autoimmune Disease': 'autoimmune disorder (lupus/RA/etc)',
        'Fibromyalgia': 'fibromyalgia syndrome',
        'Chronic Fatigue': 'chronic fatigue syndrome/ME',
        'Frequent Infections': 'immunodeficiency with recurrent infections',
        'Allergies': 'chronic allergic rhinitis/sinusitis',
        'Gulf War Illness': 'Gulf War syndrome/undiagnosed illness',
      }
    },

    // ============ DENTAL ============
    dental: {
      name: 'Dental/Oral',
      category: 'dental',
      symptoms: {
        'Tooth Loss': 'edentulism/missing teeth from trauma',
        'Jaw Pain': 'temporomandibular joint disorder',
        'Gum Disease': 'chronic periodontitis',
        'Dental Trauma': 'dental trauma with ongoing treatment needs',
        'Dry Mouth': 'xerostomia secondary to medication',
      }
    },
  };

  // Category definitions for filtering
  const CATEGORIES = {
    musculoskeletal: { name: 'Musculoskeletal', emoji: '🦴', color: 'yellow' },
    cardiovascular: { name: 'Heart & Blood', emoji: '❤️', color: 'red' },
    respiratory: { name: 'Lungs', emoji: '🫁', color: 'blue' },
    digestive: { name: 'Digestive', emoji: '🍽️', color: 'orange' },
    genitourinary: { name: 'Kidney/Urinary', emoji: '🫘', color: 'purple' },
    neurological: { name: 'Neurological', emoji: '🧠', color: 'pink' },
    mental_health: { name: 'Mental Health', emoji: '🧘', color: 'green' },
    skin: { name: 'Skin', emoji: '🩹', color: 'amber' },
    sensory: { name: 'Eyes & Ears', emoji: '👁️', color: 'cyan' },
    endocrine: { name: 'Thyroid/Diabetes', emoji: '⚗️', color: 'indigo' },
    immune: { name: 'Immune System', emoji: '🛡️', color: 'lime' },
    dental: { name: 'Dental', emoji: '🦷', color: 'gray' },
  };

  useEffect(() => {
    // Update active zones based on current symptoms
    const zones = new Set();
    symptoms.forEach(symptom => {
      if (symptom.zone) zones.add(symptom.zone);
    });
    setActiveZones(zones);
  }, [symptoms]);

  const handleZoneClick = (zoneId) => {
    setSelectedZone(zoneId);
  };

  const handleSymptomSelect = (symptomType, medicalTerm) => {
    const newSymptom = {
      zone: selectedZone,
      zoneName: BODY_ZONES[selectedZone].name,
      userDescription: symptomType,
      medicalTerminology: medicalTerm,
      timestamp: new Date().toISOString(),
    };

    const updatedSymptoms = [...symptoms, newSymptom];
    setSymptoms(updatedSymptoms);
    
    if (onSymptomUpdate) {
      onSymptomUpdate(updatedSymptoms);
    }

    setSelectedZone(null);
  };

  const removeSymptom = (index) => {
    const updatedSymptoms = symptoms.filter((_, i) => i !== index);
    setSymptoms(updatedSymptoms);
    
    if (onSymptomUpdate) {
      onSymptomUpdate(updatedSymptoms);
    }
  };

  const exportToText = () => {
    if (symptoms.length === 0) return '';

    const grouped = symptoms.reduce((acc, symptom) => {
      if (!acc[symptom.zoneName]) acc[symptom.zoneName] = [];
      acc[symptom.zoneName].push(symptom.medicalTerminology);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([zone, terms]) => `${zone}: ${terms.join('; ')}`)
      .join('\n\n');
  };

  // Get zones filtered by active category
  const getZonesForCategory = () => {
    return Object.entries(BODY_ZONES).filter(([_, zone]) => zone.category === activeCategory);
  };

  return (
    <div className="bg-gray-900 border border-yellow-500/30 rounded-lg p-6 relative">
      {/* Close X Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Header */}
      <div className="mb-6 pr-12">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">
          🎯 Somatic Target - Visual Pain Map
        </h2>
        <p className="text-gray-300 text-sm">
          Click body parts OR select a body system below to log symptoms. We'll translate your pain into VA medical terminology.
        </p>
      </div>

      {/* Body System Category Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">📋 Select Body System:</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeCategory === key
                  ? 'bg-yellow-500 text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('front')}
          className={`px-4 py-2 rounded font-semibold transition ${
            view === 'front'
              ? 'bg-yellow-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Front View
        </button>
        <button
          onClick={() => setView('back')}
          className={`px-4 py-2 rounded font-semibold transition ${
            view === 'back'
              ? 'bg-yellow-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Back View
        </button>
      </div>

      {/* Body Diagram */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* SVG Body Map */}
        <div className="relative bg-gray-800 rounded-lg p-4 min-h-[500px] flex items-center justify-center">
          <svg
            viewBox="0 0 300 600"
            className="w-full max-w-xs"
            xmlns="http://www.w3.org/2000/svg"
          >
            {view === 'front' ? (
              <>
                {/* Head */}
                <ellipse
                  cx="150"
                  cy="50"
                  rx="30"
                  ry="35"
                  fill={activeZones.has('head') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('head')}
                />

                {/* Neck */}
                <rect
                  x="135"
                  y="85"
                  width="30"
                  height="25"
                  fill={activeZones.has('neck') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('neck')}
                />

                {/* Shoulders */}
                <circle
                  cx="100"
                  cy="130"
                  r="25"
                  fill={activeZones.has('shoulder_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('shoulder_left')}
                />
                <circle
                  cx="200"
                  cy="130"
                  r="25"
                  fill={activeZones.has('shoulder_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('shoulder_right')}
                />

                {/* Upper Back/Chest */}
                <rect
                  x="115"
                  y="110"
                  width="70"
                  height="80"
                  fill={activeZones.has('upper_back') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('upper_back')}
                />

                {/* Lower Back */}
                <rect
                  x="120"
                  y="190"
                  width="60"
                  height="70"
                  fill={activeZones.has('lower_back') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('lower_back')}
                />

                {/* Hips */}
                <circle
                  cx="130"
                  cy="280"
                  r="20"
                  fill={activeZones.has('hip_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('hip_left')}
                />
                <circle
                  cx="170"
                  cy="280"
                  r="20"
                  fill={activeZones.has('hip_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('hip_right')}
                />

                {/* Knees */}
                <ellipse
                  cx="125"
                  cy="400"
                  rx="22"
                  ry="28"
                  fill={activeZones.has('knee_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('knee_left')}
                />
                <ellipse
                  cx="175"
                  cy="400"
                  rx="22"
                  ry="28"
                  fill={activeZones.has('knee_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('knee_right')}
                />

                {/* Ankles/Feet */}
                <ellipse
                  cx="125"
                  cy="550"
                  rx="18"
                  ry="25"
                  fill={activeZones.has('ankle_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('ankle_left')}
                />
                <ellipse
                  cx="175"
                  cy="550"
                  rx="18"
                  ry="25"
                  fill={activeZones.has('ankle_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('ankle_right')}
                />
              </>
            ) : (
              <>
                {/* Back View */}
                {/* Head - Back */}
                <ellipse
                  cx="150"
                  cy="50"
                  rx="30"
                  ry="35"
                  fill={activeZones.has('head') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('head')}
                />

                {/* Neck - Back */}
                <rect
                  x="135"
                  y="85"
                  width="30"
                  height="25"
                  fill={activeZones.has('neck') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('neck')}
                />

                {/* Shoulders - Back */}
                <circle
                  cx="100"
                  cy="130"
                  r="25"
                  fill={activeZones.has('shoulder_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('shoulder_left')}
                />
                <circle
                  cx="200"
                  cy="130"
                  r="25"
                  fill={activeZones.has('shoulder_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('shoulder_right')}
                />

                {/* Upper Back */}
                <rect
                  x="115"
                  y="110"
                  width="70"
                  height="80"
                  fill={activeZones.has('upper_back') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('upper_back')}
                />

                {/* Lower Back - Emphasized in back view */}
                <rect
                  x="120"
                  y="190"
                  width="60"
                  height="70"
                  fill={activeZones.has('lower_back') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('lower_back')}
                />

                {/* Rest same as front */}
                <circle
                  cx="130"
                  cy="280"
                  r="20"
                  fill={activeZones.has('hip_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('hip_left')}
                />
                <circle
                  cx="170"
                  cy="280"
                  r="20"
                  fill={activeZones.has('hip_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('hip_right')}
                />
                <ellipse
                  cx="125"
                  cy="400"
                  rx="22"
                  ry="28"
                  fill={activeZones.has('knee_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('knee_left')}
                />
                <ellipse
                  cx="175"
                  cy="400"
                  rx="22"
                  ry="28"
                  fill={activeZones.has('knee_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('knee_right')}
                />
                <ellipse
                  cx="125"
                  cy="550"
                  rx="18"
                  ry="25"
                  fill={activeZones.has('ankle_left') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('ankle_left')}
                />
                <ellipse
                  cx="175"
                  cy="550"
                  rx="18"
                  ry="25"
                  fill={activeZones.has('ankle_right') ? '#ef4444' : '#4b5563'}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  className="cursor-pointer hover:fill-yellow-600 transition"
                  onClick={() => handleZoneClick('ankle_right')}
                />
              </>
            )}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-gray-900/90 p-2 rounded text-xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 bg-gray-600 border border-yellow-500 rounded"></div>
              <span className="text-gray-300">No symptoms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 border border-yellow-500 rounded"></div>
              <span className="text-gray-300">Has symptoms</span>
            </div>
          </div>

          {/* Quick Select Body Parts for Current Category */}
          <div className="absolute bottom-4 right-4 bg-gray-900/90 p-2 rounded max-w-[200px]">
            <p className="text-xs text-gray-400 mb-2">Quick Select ({CATEGORIES[activeCategory]?.name}):</p>
            <div className="flex flex-wrap gap-1">
              {getZonesForCategory().map(([zoneId, zone]) => (
                <button
                  key={zoneId}
                  onClick={() => handleZoneClick(zoneId)}
                  className={`text-xs px-2 py-1 rounded transition ${
                    activeZones.has(zoneId)
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-yellow-600 hover:text-gray-900'
                  }`}
                >
                  {zone.name.split('/')[0].split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Symptom Details Panel */}
        <div>
          {selectedZone ? (
            <div className="bg-gray-800 rounded-lg p-4 border border-yellow-500/50">
              <h3 className="text-xl font-bold text-yellow-400 mb-3">
                {BODY_ZONES[selectedZone].name}
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Select the symptoms you experience in this area:
              </p>
              <div className="space-y-2">
                {Object.entries(BODY_ZONES[selectedZone].symptoms).map(([symptom, medical]) => (
                  <button
                    key={symptom}
                    onClick={() => handleSymptomSelect(symptom, medical)}
                    className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded transition border border-gray-600 hover:border-yellow-500"
                  >
                    <div className="font-semibold text-white">{symptom}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Translates to: "{medical}"
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-xl font-bold text-yellow-400 mb-3">
                📋 Logged Symptoms ({symptoms.length})
              </h3>
              {symptoms.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  Click a body part on the diagram to start logging symptoms.
                </p>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {symptoms.map((symptom, index) => (
                      <div
                        key={index}
                        className="bg-gray-700 p-3 rounded border border-gray-600"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-yellow-400 text-sm">
                            {symptom.zoneName}
                          </span>
                          <button
                            onClick={() => removeSymptom(index)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-white text-sm">{symptom.userDescription}</div>
                        <div className="text-gray-400 text-xs mt-1 italic">
                          Medical: {symptom.medicalTerminology}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={() => {
                      const text = exportToText();
                      navigator.clipboard.writeText(text);
                      alert('Medical terminology copied to clipboard!');
                    }}
                    className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold rounded transition"
                  >
                    📋 Copy Medical Text
                  </button>
                  
                  {/* Log to Symptom Logger Button */}
                  <button
                    onClick={() => {
                      // Save symptom data to localStorage for SymptomLogger to pick up
                      const logData = {
                        type: 'pain',
                        bodyPart: symptoms.map(s => s.zoneName).join(', '),
                        medicalTerm: symptoms.map(s => s.medicalTerminology).join('; '),
                        notes: symptoms.map(s => `${s.zoneName}: ${s.userDescription} (${s.medicalTerminology})`).join('\n'),
                        timestamp: Date.now()
                      };
                      localStorage.setItem('vetrate_symptom_prefill', JSON.stringify(logData));
                      
                      // Call the callback if provided
                      if (onLogToSymptomLogger) {
                        onLogToSymptomLogger(logData);
                      } else {
                        alert('Pain data saved! Open the Symptom Logger (The 50% Maker) to log this episode.');
                      }
                    }}
                    className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded transition"
                  >
                    📊 Log to Symptom Logger
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Usage Tips */}
      <div className="mt-6 bg-blue-900/30 border border-blue-500/30 rounded p-4">
        <h4 className="text-blue-400 font-bold mb-2">💡 Pro Tips:</h4>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• Click multiple body parts to build a complete symptom profile</li>
          <li>• The app translates your clicks into exact VA medical terminology</li>
          <li>• Copy the medical text and paste it into your Personal Statement</li>
          <li>• Red zones show where you've logged symptoms</li>
        </ul>
      </div>
    </div>
  );
};

export default BodyMapSelector;
