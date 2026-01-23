import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReportBugLink from './ReportBugLink';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import disabilityData from '../data/disabilityData.json';
import { getMyRatings, hasMyRatings, addRating } from '../utils/veteranProfile';
import VAGovRatingPaster from './VAGovRatingPaster';
import { analyzePDF, OCR_STATES, getProgressStyling, formatFileSize } from '../utils/ocr';

/**
 * SecondaryScoutLauncher Component
 * Allows users to select their conditions before launching the Secondary Scout
 * Organized by body system per 38 CFR Part 4, Subpart B - Schedule for Rating Disabilities
 */
const SecondaryScoutLauncher = ({ onLaunch, onClose, onReportBug }) => {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  const [inputMethod, setInputMethod] = useState('manual'); // 'manual', 'checkbox', 'examples', 'myratings', 'paste', or 'pdf'
  const [manualInput, setManualInput] = useState('');
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedSystems, setExpandedSystems] = useState(new Set());
  const [savedRatings, setSavedRatings] = useState([]);
  const [showVAGovPaster, setShowVAGovPaster] = useState(false);
  
  // PDF Drop-In state
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfOcrProgress, setPdfOcrProgress] = useState(null);
  const [pdfIsDragging, setPdfIsDragging] = useState(false);
  const [extractedPdfConditions, setExtractedPdfConditions] = useState([]);
  const [pdfError, setPdfError] = useState(null);
  const pdfFileInputRef = useRef(null);
  
  // Load saved ratings on mount
  useEffect(() => {
    const ratings = getMyRatings();
    setSavedRatings(ratings);
  }, []);

  // PDF Drop-In handlers
  const handlePdfDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(true);
  };

  const handlePdfDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(false);
  };

  const handlePdfDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        await processPdfFile(file);
      } else {
        setPdfError('Please drop a PDF file (VA decision letter, rating decision, etc.)');
      }
    }
  };

  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processPdfFile(file);
    }
  };

  const processPdfFile = async (file) => {
    setPdfFile(file);
    setPdfError(null);
    setExtractedPdfConditions([]);
    
    try {
      const result = await analyzePDF(file, (progress) => {
        setPdfOcrProgress(progress);
      });
      
      if (result.success && result.text) {
        // Parse conditions from the extracted text
        const conditions = parseConditionsFromText(result.text);
        setExtractedPdfConditions(conditions);
        
        if (conditions.length === 0) {
          setPdfError('No conditions found in this document. Try pasting the text manually or use a different document.');
        }
      } else {
        setPdfError(result.error || 'Failed to extract text from PDF');
      }
    } catch (err) {
      console.error('PDF processing error:', err);
      setPdfError('Failed to process PDF. Please try again or paste the text manually.');
    }
    
    setPdfOcrProgress(null);
  };

  const parseConditionsFromText = (text) => {
    const conditions = [];
    const seenConditions = new Set();
    
    // Common patterns in VA decision letters and rating decisions
    const patterns = [
      // "XX% rating for [condition]" format
      /(\d+)%?\s+(?:rating|disability|service.connected)?\s*(?:for|:)?\s*([^,\n]+)/gi,
      // "Service connection for [condition] is granted/continued"
      /service\s+connection\s+(?:for\s+)?([^,\n.]+?)(?:\s+is|\s+has been|\s+granted|\s+continued)/gi,
      // "Your [condition] is rated at XX%"
      /your\s+([^,\n]+?)\s+is\s+rated\s+at\s+(\d+)%/gi,
      // Diagnostic Code patterns: "[Condition], Diagnostic Code XXXX"
      /([A-Z][a-z\s]+(?:,\s*[a-z]+)*),?\s+(?:DC|Diagnostic Code)\s*\d{4}/gi,
      // "[Condition] (DC XXXX)" format
      /([A-Z][a-z\s,]+?)\s*\((?:DC|Diagnostic Code)\s*\d{4}\)/gi,
      // Conditions with percentages at start of lines
      /^(?:\s*[-•*]\s*)?([A-Z][a-zA-Z\s,]+?)\s*[-–—:]\s*(\d+)%/gm,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let condition = match[1]?.trim() || match[2]?.trim();
        if (condition) {
          // Clean up the condition name
          condition = condition
            .replace(/\s+/g, ' ')
            .replace(/^\d+%?\s*/, '')
            .replace(/\s*[-–—:]\s*\d+%?\s*$/, '')
            .replace(/^\s*for\s+/i, '')
            .trim();
          
          // Skip if too short, too long, or common non-condition text
          if (condition.length < 3 || condition.length > 100) continue;
          const skipWords = ['the', 'and', 'for', 'your', 'this', 'that', 'with', 'from', 'have', 'been', 'will', 'evidence', 'records', 'medical', 'examination'];
          if (skipWords.some(w => condition.toLowerCase() === w)) continue;
          
          // Normalize for deduplication
          const normalized = condition.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!seenConditions.has(normalized) && normalized.length > 2) {
            seenConditions.add(normalized);
            // Capitalize first letter of each word
            condition = condition.replace(/\b\w/g, c => c.toUpperCase());
            conditions.push(condition);
          }
        }
      }
    }
    
    return conditions;
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfOcrProgress(null);
    setExtractedPdfConditions([]);
    setPdfError(null);
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
    }
  };

  const handlePdfConditionsSubmit = () => {
    if (extractedPdfConditions.length > 0) {
      onLaunch(extractedPdfConditions);
    }
  };

  // Organized by body system per 38 CFR Part 4, Subpart B - Schedule for Rating Disabilities
  const conditionsBySystem = {
    // ═══════════════════════════════════════════════════════════════════
    // MUSCULOSKELETAL SYSTEM (§§ 4.40-4.73)
    // ═══════════════════════════════════════════════════════════════════
    '🦴 Musculoskeletal - Spine (DC 5235-5243)': [
      'Lumbosacral or Cervical Strain (DC 5237)',
      'Spinal Stenosis (DC 5238)',
      'Spondylolisthesis or Segmental Instability (DC 5239)',
      'Ankylosing Spondylitis (DC 5240)',
      'Spinal Fusion (DC 5241)',
      'Degenerative Arthritis of the Spine (DC 5242)',
      'Intervertebral Disc Syndrome (DC 5243)',
      'Vertebral Fracture or Dislocation (DC 5235)',
      'Sacroiliac Injury and Weakness (DC 5236)'
    ],
    '🦴 Musculoskeletal - Shoulder & Arm (DC 5200-5203)': [
      'Scapulohumeral Articulation, Ankylosis of (DC 5200)',
      'Arm, Limitation of Motion of (DC 5201)',
      'Humerus, Other Impairment of (DC 5202)',
      'Clavicle or Scapula, Impairment of (DC 5203)',
      'Shoulder Replacement (DC 5051)',
      'Rotator Cuff Tear (rated under DC 5201)',
      'Shoulder Arthritis (rated under DC 5003, 5201)',
      'Shoulder Instability (rated under DC 5202)'
    ],
    '🦴 Musculoskeletal - Elbow & Forearm (DC 5205-5213)': [
      'Elbow Ankylosis (DC 5205)',
      'Forearm, Limitation of Flexion (DC 5206)',
      'Forearm, Limitation of Extension (DC 5207)',
      'Forearm, Flexion Limited to 100° and Extension to 45° (DC 5208)',
      'Elbow, Other Impairment (Flail Joint) (DC 5209)',
      'Radius and Ulna, Nonunion of (DC 5210)',
      'Ulna, Impairment of (DC 5211)',
      'Radius, Impairment of (DC 5212)',
      'Supination and Pronation, Impairment of (DC 5213)',
      'Elbow Replacement (DC 5052)',
      'Lateral Epicondylitis (Tennis Elbow) (rated under DC 5024)',
      'Medial Epicondylitis (Golfer\'s Elbow) (rated under DC 5024)',
      'Elbow Arthritis (rated under DC 5003)'
    ],
    '🦴 Musculoskeletal - Wrist & Hand (DC 5214-5230)': [
      'Wrist Ankylosis (DC 5214)',
      'Wrist, Limitation of Motion (DC 5215)',
      'Thumb Ankylosis (DC 5224)',
      'Index Finger Ankylosis (DC 5225)',
      'Long Finger Ankylosis (DC 5226)',
      'Ring or Little Finger Ankylosis (DC 5227)',
      'Thumb, Limitation of Motion (DC 5228)',
      'Index or Long Finger, Limitation of Motion (DC 5229)',
      'Ring or Little Finger, Limitation of Motion (DC 5230)',
      'Wrist Replacement (DC 5053)',
      'Wrist Arthritis (rated under DC 5003, 5215)',
      'Hand Injury (rated under DC 5309)',
      'Trigger Finger (rated under DC 5024)',
      'Dupuytren\'s Contracture (rated under DC 5229)',
      'De Quervain\'s Tenosynovitis (rated under DC 5024)'
    ],
    '🦴 Musculoskeletal - Hip & Thigh (DC 5250-5255)': [
      'Hip Ankylosis (DC 5250)',
      'Thigh, Limitation of Extension (DC 5251)',
      'Thigh, Limitation of Flexion (DC 5252)',
      'Thigh, Impairment of (DC 5253)',
      'Hip, Flail Joint (DC 5254)',
      'Femur, Impairment of (DC 5255)',
      'Hip, Resurfacing or Replacement (DC 5054)',
      'Hip Arthritis (rated under DC 5003, 5252)',
      'Hip Bursitis (rated under DC 5019)',
      'Hip Limitation of Motion (rated under DC 5251-5253)'
    ],
    '🦴 Musculoskeletal - Knee & Leg (DC 5256-5263)': [
      'Knee Ankylosis (DC 5256)',
      'Knee, Other Impairment (Instability) (DC 5257)',
      'Cartilage, Semilunar, Dislocated (DC 5258)',
      'Cartilage, Semilunar, Removal of, Symptomatic (DC 5259)',
      'Leg, Limitation of Flexion (DC 5260)',
      'Leg, Limitation of Extension (DC 5261)',
      'Tibia and Fibula, Impairment of (DC 5262)',
      'Genu Recurvatum (DC 5263)',
      'Medial Tibial Stress Syndrome (Shin Splints) (DC 5262)',
      'Knee, Resurfacing or Replacement (DC 5055)',
      'Knee Degenerative Arthritis (rated under DC 5003, 5260, 5261)',
      'Knee Instability (rated under DC 5257)',
      'Knee Meniscal Condition (rated under DC 5258, 5259)'
    ],
    '🦴 Musculoskeletal - Ankle & Foot (DC 5269-5284)': [
      'Plantar Fasciitis (DC 5269)',
      'Ankle Ankylosis (DC 5270)',
      'Ankle Limited Motion (DC 5271)',
      'Subastragalar or Tarsal Joint Ankylosis (DC 5272)',
      'Os Calcis or Astragalus Malunion (DC 5273)',
      'Astragalectomy (DC 5274)',
      'Flatfoot, Acquired (DC 5276)',
      'Weak Foot, Bilateral (DC 5277)',
      'Claw Foot (Pes Cavus), Acquired (DC 5278)',
      'Metatarsalgia, Anterior (Morton\'s Disease) (DC 5279)',
      'Hallux Valgus (DC 5280)',
      'Hallux Rigidus (DC 5281)',
      'Hammer Toe (DC 5282)',
      'Tarsal or Metatarsal Bones Malunion/Nonunion (DC 5283)',
      'Foot Injuries, Other (DC 5284)',
      'Ankle Replacement (DC 5056)',
      'Ankle Arthritis (rated under DC 5003, 5271)',
      'Achilles Tendinitis (rated under DC 5024)'
    ],
    '🦴 Musculoskeletal - Systemic/Arthritis (DC 5000-5025)': [
      'Osteomyelitis, Acute, Subacute, or Chronic (DC 5000)',
      'Multi-Joint Arthritis (except post-traumatic and gout) (DC 5002)',
      'Degenerative Arthritis, Other Than Post-Traumatic (DC 5003)',
      'Post-Traumatic Arthritis (DC 5010)',
      'Osteoporosis, Residuals of (DC 5013)',
      'Osteomalacia, Residuals of (DC 5014)',
      'Osteitis Deformans (DC 5016)',
      'Gout (DC 5017)',
      'Bursitis (DC 5019)',
      'Myositis (DC 5021)',
      'Heterotopic Ossification (DC 5023)',
      'Tenosynovitis, Tendinitis, Tendinosis or Tendinopathy (DC 5024)',
      'Fibromyalgia (DC 5025)'
    ],
    '🦴 Musculoskeletal - Muscle Injuries (DC 5301-5329)': [
      'Muscle Injury - Shoulder Girdle, Group I-IV (DC 5301-5304)',
      'Muscle Injury - Arm, Group V-VI (DC 5305-5306)',
      'Muscle Injury - Forearm/Hand, Group VII-IX (DC 5307-5309)',
      'Muscle Injury - Foot/Leg, Group X-XII (DC 5310-5312)',
      'Muscle Injury - Thigh/Pelvis, Group XIII-XVIII (DC 5313-5318)',
      'Muscle Injury - Torso/Neck, Group XIX-XXIII (DC 5319-5323)',
      'Muscle Hernia (DC 5326)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // ORGANS OF SPECIAL SENSE - EYE (§§ 4.75-4.79)
    // ═══════════════════════════════════════════════════════════════════
    '👁️ Eye Conditions (DC 6000-6091)': [
      'Cataracts (DC 6027-6029)',
      'Glaucoma (DC 6012, 6013)',
      'Macular Degeneration (DC 6007)',
      'Diabetic Retinopathy (DC 6006)',
      'Retinal Detachment (DC 6008)',
      'Iridocyclitis (Uveitis/Iritis) (DC 6003)',
      'Keratopathy (Keratitis) (DC 6001)',
      'Scleritis (DC 6002)',
      'Conjunctivitis (DC 6017, 6018)',
      'Dry Eye Syndrome (rated under DC 6025)',
      'Ptosis, Unilateral (DC 6019)',
      'Diplopia (DC 6090)',
      'Visual Field Loss (DC 6080)',
      'Visual Acuity Loss (DC 6061-6079)',
      'Eye Injury Residuals (rated analogously)',
      'Optic Neuropathy (DC 6026)',
      'Corneal Dystrophy (rated under DC 6001)',
      'Ectropion (DC 6020)',
      'Entropion (DC 6021)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // IMPAIRMENT OF AUDITORY ACUITY (§§ 4.85-4.87a)
    // ═══════════════════════════════════════════════════════════════════
    '👂 Ear & Hearing (DC 6100-6276)': [
      'Hearing Impairment (DC 6100)',
      'Tinnitus, Recurrent (DC 6260)',
      'Meniere\'s Syndrome (DC 6205)',
      'Peripheral Vestibular Disorders (DC 6204)',
      'Loss of Auricle (DC 6207)',
      'Malignant Neoplasm of Ear (DC 6208)',
      'Benign Neoplasms of Ear (DC 6209)',
      'Chronic Otitis Media (DC 6200)',
      'Chronic Otitis Externa (DC 6210)',
      'Tympanic Membrane, Perforation of (DC 6211)',
      'Mastoiditis, Chronic (DC 6201)',
      'Labyrinthitis, Chronic (DC 6202)',
      'Cholesteatoma (DC 6200)',
      'Otosclerosis (DC 6202)',
      'Loss of Sense of Smell (DC 6275)',
      'Loss of Sense of Taste (DC 6276)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // INFECTIOUS DISEASES, IMMUNE DISORDERS & NUTRITIONAL DEFICIENCIES (§§ 4.88-4.89)
    // ═══════════════════════════════════════════════════════════════════
    '🦠 Infectious & Immune Disorders (DC 6300-6354)': [
      'Chronic Fatigue Syndrome (DC 6354)',
      'Lupus Erythematosus, Systemic (DC 6350)',
      'HIV-Related Illness (DC 6351)',
      'Lyme Disease (DC 6319)',
      'Tuberculosis, Pulmonary, Chronic Active (DC 6730)',
      'Tuberculosis, Miliary (DC 6314)',
      'Hepatitis B (DC 7345)',
      'Hepatitis C (DC 7354)',
      'Malaria (DC 6304)',
      'Brucellosis (DC 6305)',
      'Leishmaniasis (DC 6301)',
      'Leprosy (Hansen\'s Disease) (DC 6302)',
      'Syphilis (DC 6310)',
      'West Nile Virus Residuals (DC 6335)',
      'Fibromyalgia (DC 5025)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // RESPIRATORY SYSTEM (§§ 4.96-4.97)
    // ═══════════════════════════════════════════════════════════════════
    '🫁 Respiratory System (DC 6502-6847)': [
      'Deviated Nasal Septum (DC 6502)',
      'Sinusitis, Chronic Maxillary (DC 6513)',
      'Sinusitis, Chronic Pansinusitis (DC 6514)',
      'Rhinitis, Allergic or Vasomotor (DC 6522)',
      'Bacterial Rhinitis (DC 6523)',
      'Granulomatous Rhinitis (DC 6524)',
      'Laryngitis, Chronic (DC 6516)',
      'Aphonia, Complete Organic (DC 6519)',
      'Stenosis of Larynx (DC 6520)',
      'Asthma, Bronchial (DC 6602)',
      'Bronchitis, Chronic (DC 6600)',
      'Emphysema, Pulmonary (DC 6603)',
      'COPD (rated under DC 6604)',
      'Bronchiectasis (DC 6601)',
      'Pulmonary Fibrosis (DC 6825)',
      'Restrictive Lung Disease (rated under DC 6845)',
      'Pneumoconiosis (DC 6832)',
      'Asbestosis (DC 6833)',
      'Sarcoidosis (DC 6846)',
      'Sleep Apnea Syndromes (DC 6847)',
      'Pulmonary Vascular Disease (DC 6817)',
      'Pleural Effusion, Chronic (DC 6844)',
      'Residuals of Lung Surgery (rated under DC 6844)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // CARDIOVASCULAR SYSTEM (§§ 4.100-4.104)
    // ═══════════════════════════════════════════════════════════════════
    '❤️ Cardiovascular System (DC 7000-7124)': [
      'Hypertensive Vascular Disease (DC 7101)',
      'Arteriosclerotic Heart Disease (DC 7005)',
      'Coronary Artery Disease (rated under DC 7005)',
      'Myocardial Infarction (DC 7006)',
      'Cardiomyopathy (DC 7020)',
      'Valvular Heart Disease (DC 7000)',
      'Supraventricular Arrhythmias (DC 7010)',
      'Ventricular Arrhythmias (DC 7011)',
      'Atrial Fibrillation (DC 7010)',
      'Heart Failure, Congestive (DC 7007)',
      'Pericarditis (DC 7002)',
      'Endocarditis (DC 7001)',
      'Pacemaker Implant (DC 7018)',
      'Aortic Aneurysm (DC 7110, 7111)',
      'Arteriosclerosis Obliterans (DC 7114)',
      'Thromboangiitis Obliterans (DC 7115)',
      'Varicose Veins (DC 7120)',
      'Post-Phlebitic Syndrome (DC 7121)',
      'Raynaud\'s Syndrome (DC 7117)',
      'Cold Injury Residuals (DC 7122)',
      'Arteriovenous Fistula (DC 7113)',
      'Lymphedema (DC 7121)',
      'Angioneurotic Edema (DC 7118)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // DIGESTIVE SYSTEM (§§ 4.110-4.114)
    // ═══════════════════════════════════════════════════════════════════
    '🍽️ Digestive System (DC 7200-7357)': [
      'Esophagus, Stricture of (DC 7203)',
      'Esophagus, Spasm of (DC 7204)',
      'Diverticulum of the Esophagus (DC 7205)',
      'Stomach, Injury Residuals (DC 7310)',
      'Ulcer Disease, Duodenal (DC 7305)',
      'Ulcer Disease, Gastric (DC 7304)',
      'Gastritis, Chronic, Hypertrophic (DC 7307)',
      'Post-Gastrectomy Syndromes (DC 7308)',
      'Stomach, Stenosis of (DC 7309)',
      'Hiatal Hernia (DC 7346)',
      'GERD (rated under DC 7346)',
      'Irritable Colon Syndrome (DC 7319)',
      'Colitis, Ulcerative (DC 7323)',
      'Ileitis (Crohn\'s Disease) (DC 7323)',
      'Diverticulitis (DC 7327)',
      'Intestine, Resection (DC 7328, 7329)',
      'Peritoneal Adhesions (DC 7301)',
      'Hemorrhoids, External or Internal (DC 7336)',
      'Anus, Stricture of (DC 7333)',
      'Anus, Prolapse of (DC 7334)',
      'Fistula in Ano (DC 7335)',
      'Rectum, Prolapse of (DC 7334)',
      'Cirrhosis of Liver (DC 7312)',
      'Liver, Chronic Disease (DC 7345, 7354)',
      'Pancreatitis, Chronic (DC 7347)',
      'Cholecystitis, Chronic (DC 7314)',
      'Cholelithiasis (DC 7314)',
      'Inguinal Hernia (DC 7338)',
      'Ventral Hernia (DC 7339)',
      'Celiac Disease (DC 7325)',
      'Malabsorption Syndrome (DC 7325)',
      'Fecal Incontinence (DC 7332)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // GENITOURINARY SYSTEM (§§ 4.115-4.115b)
    // ═══════════════════════════════════════════════════════════════════
    '� Genitourinary System (DC 7500-7542)': [
      'Kidney Disease, Chronic (DC 7530-7541)',
      'Renal Dysfunction (DC 7500-7509)',
      'Kidney, Removal of One (DC 7500)',
      'Kidney, Injury, Residuals (DC 7502)',
      'Nephrolithiasis (DC 7508)',
      'Hydronephrosis (DC 7509)',
      'Pyelonephritis, Chronic (DC 7504)',
      'Nephritis, Chronic (DC 7501, 7502)',
      'Ureterolithiasis (DC 7510)',
      'Ureter, Stricture of (DC 7511)',
      'Cystitis, Chronic (DC 7512)',
      'Bladder, Injury, Residuals (DC 7516, 7517)',
      'Voiding Dysfunction (DC 7542)',
      'Urinary Incontinence (DC 7542)',
      'Urinary Frequency (DC 7542)',
      'Urinary Tract Infection (DC 7512)',
      'Prostate Gland Injuries, Infections (DC 7527)',
      'Benign Prostatic Hyperplasia (DC 7527)',
      'Prostatitis (DC 7527)',
      'Erectile Dysfunction (DC 7522)',
      'Testicular Atrophy (DC 7523)',
      'Kidney Transplant (DC 7531)',
      'Dialysis Requirement (DC 7530)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // GYNECOLOGICAL CONDITIONS (§§ 4.116)
    // ═══════════════════════════════════════════════════════════════════
    '♀️ Gynecological Conditions (DC 7610-7631)': [
      'Vulva, Disease or Injury of (DC 7610)',
      'Vagina, Disease or Injury of (DC 7611)',
      'Cervix, Disease or Injury of (DC 7612)',
      'Uterus, Disease, Injury, or Adhesions (DC 7613)',
      'Fallopian Tube, Disease, Injury, or Adhesions (DC 7614)',
      'Ovary, Disease, Injury, or Adhesions (DC 7615)',
      'Ovary, Removal of (DC 7619)',
      'Uterus, Removal of (DC 7617, 7618)',
      'Endometriosis (DC 7629)',
      'Ovarian Cysts (rated under DC 7615)',
      'Uterine Leiomyoma (Fibroids) (DC 7613)',
      'Pelvic Inflammatory Disease (DC 7614, 7615)',
      'Menstrual Disorders (rated analogously)',
      'Breast, Disease or Injury, Unlisted (DC 7626-7628)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // HEMATOLOGIC AND LYMPHATIC SYSTEMS (§ 4.117)
    // ═══════════════════════════════════════════════════════════════════
    '🩸 Hematologic & Lymphatic (DC 7700-7725)': [
      'Anemia, Hypochromic-Microcytic and Megaloblastic (DC 7700)',
      'Anemia, Pernicious (DC 7700)',
      'Sickle Cell Anemia (DC 7714)',
      'Leukemia (DC 7703)',
      'Hodgkin\'s Disease (DC 7709)',
      'Non-Hodgkin\'s Lymphoma (DC 7715)',
      'Multiple Myeloma (DC 7709)',
      'Polycythemia Vera (DC 7704)',
      'Thrombocytopenia, Idiopathic or Immune (DC 7705)',
      'Spleen, Removal of (DC 7706)',
      'Spleen, Injury, Residuals (DC 7707)',
      'Lymphadenitis (DC 7710)',
      'Agranulocytosis (DC 7702)',
      'Aplastic Anemia (DC 7716)',
      'Hemophilia (DC 7705)',
      'Bone Marrow Transplant (DC 7717)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // SKIN CONDITIONS (§ 4.118)
    // ═══════════════════════════════════════════════════════════════════
    '🧴 Skin Conditions (DC 7800-7833)': [
      'Scars, Disfigurement of Head, Face, or Neck (DC 7800)',
      'Scars, Burn (DC 7801, 7802)',
      'Scars, Unstable or Painful (DC 7804)',
      'Scars, Other (DC 7805)',
      'Dermatitis or Eczema (DC 7806)',
      'Psoriasis (DC 7816)',
      'Acne (DC 7828)',
      'Chloracne (DC 7829)',
      'Dermatophytosis (Tinea/Fungal Infections) (DC 7813)',
      'Tinea Barbae (DC 7814)',
      'Urticaria (DC 7825)',
      'Hyperhidrosis (DC 7832)',
      'Alopecia Areata (DC 7831)',
      'Vitiligo (DC 7823)',
      'Malignant Melanoma (DC 7833)',
      'Skin Cancer, Other (DC 7818)',
      'Benign Skin Neoplasms (DC 7819)',
      'Pemphigus (DC 7815)',
      'Bullous Disorders (DC 7815)',
      'Lupus Erythematosus, Cutaneous (DC 7809)',
      'Erythroderma (DC 7817)',
      'Hidradenitis Suppurativa (DC 7820)',
      'Leishmaniasis, Cutaneous (DC 7807)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // ENDOCRINE SYSTEM (§ 4.119)
    // ═══════════════════════════════════════════════════════════════════
    '⚗️ Endocrine System (DC 7900-7919)': [
      'Diabetes Mellitus (DC 7913)',
      'Diabetic Nephropathy (rated under DC 7541)',
      'Diabetic Retinopathy (rated under DC 6006)',
      'Diabetic Peripheral Neuropathy (rated under DC 8520)',
      'Hypothyroidism (DC 7903)',
      'Hyperthyroidism (Toxic Diffuse Goiter, Graves\' Disease) (DC 7900)',
      'Thyroiditis (DC 7902)',
      'Thyroid Enlargement, Nontoxic (DC 7901)',
      'Hyperparathyroidism (DC 7904)',
      'Hypoparathyroidism (DC 7905)',
      'Cushing\'s Syndrome (DC 7907)',
      'Addison\'s Disease (DC 7911)',
      'Acromegaly (DC 7908)',
      'Hyperpituitarism (DC 7909)',
      'Hypopituitarism (DC 7906)',
      'Pheochromocytoma (DC 7915)',
      'C-Cell Hyperplasia of Thyroid (DC 7914)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // NEUROLOGICAL CONDITIONS (§§ 4.120-4.124a)
    // ═══════════════════════════════════════════════════════════════════
    '🧠 Neurological - Brain & Central Nervous (DC 8000-8046)': [
      'Traumatic Brain Injury (TBI) (DC 8045)',
      'Epilepsy, Grand Mal (DC 8910)',
      'Epilepsy, Petit Mal (DC 8911)',
      'Multiple Sclerosis (DC 8018)',
      'Parkinson\'s Disease (Paralysis Agitans) (DC 8004)',
      'Migraine (DC 8100)',
      'Cerebrovascular Disease Residuals (CVA/Stroke) (DC 8007, 8008)',
      'Brain, New Growth (DC 8002, 8003)',
      'Meningitis, Epidemic Cerebrospinal (DC 8019)',
      'Encephalitis, Epidemic (DC 8000)',
      'ALS (DC 8017)',
      'Syringomyelia (DC 8024)',
      'Dementia (rated under DC 8045, 9326)',
      'Narcolepsy (DC 8108)',
      'Myasthenia Gravis (DC 8025)',
      'Chorea, Huntington\'s (DC 8106)',
      'Chorea, Sydenham\'s (DC 8105)'
    ],
    '🧠 Neurological - Cranial Nerves (DC 8205-8412)': [
      'Trigeminal Nerve, Paralysis of (5th) (DC 8205)',
      'Facial Nerve, Paralysis of (7th) (DC 8207)',
      'Glossopharyngeal Nerve, Paralysis of (9th) (DC 8209)',
      'Pneumogastric (Vagus) Nerve, Paralysis of (10th) (DC 8210)',
      'Spinal Accessory Nerve, Paralysis of (11th) (DC 8211)',
      'Hypoglossal Nerve, Paralysis of (12th) (DC 8212)',
      'Tic Douloureux (Trigeminal Neuralgia) (DC 8405)'
    ],
    '🧠 Neurological - Peripheral Nerves (DC 8510-8730)': [
      'Median Nerve, Paralysis of (Carpal Tunnel) (DC 8515)',
      'Ulnar Nerve, Paralysis of (DC 8516)',
      'Radial Nerve, Paralysis of (DC 8514)',
      'Musculocutaneous Nerve, Paralysis of (DC 8517)',
      'Sciatic Nerve, Paralysis of (DC 8520)',
      'External Popliteal (Common Peroneal) Nerve, Paralysis of (DC 8521)',
      'Tibial (Posterior) Nerve, Paralysis of (Tarsal Tunnel) (DC 8525)',
      'Anterior Crural (Femoral) Nerve, Paralysis of (DC 8526)',
      'Internal Popliteal (Tibial) Nerve, Paralysis of (DC 8524)',
      'Long Thoracic Nerve, Paralysis of (DC 8519)',
      'Upper Radicular Group (Erb-Duchenne) (DC 8510)',
      'Lower Radicular Group (Klumpke-Dejerine) (DC 8512)',
      'Middle Radicular Group (DC 8511)',
      'All Radicular Groups (DC 8513)',
      'Radiculopathy, Cervical (rated under affected nerve)',
      'Radiculopathy, Lumbar (rated under affected nerve)',
      'Sciatica (rated under DC 8520)',
      'Peripheral Neuropathy (rated under affected nerves)',
      'Small Fiber Neuropathy (rated under affected nerves)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // MENTAL DISORDERS (§§ 4.125-4.130)
    // ═══════════════════════════════════════════════════════════════════
    '🧩 Mental Health - Trauma & Stressor (DC 9400-9440)': [
      'Post-Traumatic Stress Disorder (PTSD) (DC 9411)',
      'Acute Stress Disorder (DC 9413)',
      'Adjustment Disorders (DC 9440)',
      'Prolonged Grief Disorder (DC 9412)',
      'Dissociative Amnesia (DC 9416)',
      'Depersonalization/Derealization Disorder (DC 9417)'
    ],
    '🧩 Mental Health - Mood Disorders': [
      'Major Depressive Disorder (DC 9434)',
      'Persistent Depressive Disorder (Dysthymia) (DC 9433)',
      'Bipolar I Disorder (DC 9432)',
      'Bipolar II Disorder (DC 9432)',
      'Cyclothymic Disorder (DC 9431)'
    ],
    '🧩 Mental Health - Anxiety Disorders': [
      'Generalized Anxiety Disorder (DC 9400)',
      'Panic Disorder with or without Agoraphobia (DC 9412)',
      'Social Anxiety Disorder (DC 9403)',
      'Specific Phobias (DC 9403)',
      'Agoraphobia (DC 9403)'
    ],
    '🧩 Mental Health - Other': [
      'Obsessive-Compulsive Disorder (OCD) (DC 9404)',
      'Somatic Symptom and Related Disorders (DC 9422)',
      'Illness Anxiety Disorder (DC 9424)',
      'Schizophrenia (DC 9203, 9204, 9205)',
      'Schizoaffective Disorder (DC 9211)',
      'Delusional Disorder (DC 9208)',
      'Eating Disorders (DC 9520, 9521)',
      'Insomnia Disorder (rated under DC 9413)',
      'Substance Use Disorders (DC 9431)',
      'Major or Mild Neurocognitive Disorders (DC 9326)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // DENTAL AND ORAL CONDITIONS (§§ 4.149-4.150)
    // ═══════════════════════════════════════════════════════════════════
    '🦷 Dental & Oral Conditions (DC 9900-9916)': [
      'Temporomandibular Articulation, Limited Motion of (DC 9905)',
      'Mandible, Loss of All or Part (DC 9901-9902)',
      'Maxilla, Loss of All or Part (DC 9914-9915)',
      'Ramus, Loss of (DC 9906-9907)',
      'Condyloid Process, Loss of (DC 9908-9909)',
      'Hard Palate, Loss of (DC 9910-9911)',
      'Teeth, Loss of, Due to Loss of Substance (DC 9913)',
      'Osteomyelitis (DC 9900)',
      'Osteoradionecrosis (DC 9900)',
      'Malunion of Mandible (DC 9904)',
      'Nonunion of Mandible (DC 9903)'
    ]
  };

  const exampleProfiles = [
    {
      name: 'Anth\'s Profile (Site Creator)',
      description: '50% PTSD, 20% spine, 20% left radiculopathy, bilateral hip issues, tinnitus',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Lumbosacral Strain with Degenerative Disc Disease',
        'Radiculopathy - Left Lower Extremity (Femoral)',
        'Radiculopathy - Right Lower Extremity (Femoral)',
        'Left Hip Limited Adduction',
        'Right Hip Limited Adduction',
        'Left Hip Limited Extension',
        'Right Hip Limited Extension',
        'Iliotibial Band Syndrome / Greater Trochanteric Pain Syndrome - Left Hip',
        'Iliotibial Band Syndrome / Greater Trochanteric Pain Syndrome - Right Hip',
        'Tinnitus',
        'Reactive Airway Disease',
        'Rhinitis'
      ]
    },
    {
      name: 'Agent Orange Exposure',
      description: 'Presumptive conditions from herbicide exposure (Vietnam era)',
      conditions: [
        'Diabetes Mellitus Type II',
        'Ischemic Heart Disease',
        'Peripheral Neuropathy (Toxic)',
        'Prostate Cancer',
        'Chloracne',
        'Parkinson\'s Disease',
        'Hypertension (High Blood Pressure)',
        'Bladder Cancer'
      ]
    },
    {
      name: 'Blast Exposure/TBI Veteran',
      description: 'TBI, hearing loss, and related neurological issues',
      conditions: [
        'Traumatic Brain Injury (TBI)',
        'Tinnitus',
        'Hearing Loss (Sensorineural)',
        'Migraine Headaches',
        'Vertigo',
        'PTSD (Post-Traumatic Stress Disorder)',
        'Sleep Apnea (Obstructive)',
        'Cognitive Disorder'
      ]
    },
    {
      name: 'Camp Lejeune Water Contamination',
      description: 'Presumptive conditions from contaminated water exposure',
      conditions: [
        'Kidney Cancer',
        'Liver Cancer',
        'Bladder Cancer',
        'Non-Hodgkin\'s Lymphoma',
        'Multiple Myeloma',
        'Parkinson\'s Disease',
        'Hepatic Steatosis (Fatty Liver)',
        'Infertility'
      ]
    },
    {
      name: 'Chronic Pain & Fibromyalgia',
      description: 'Widespread musculoskeletal pain and related conditions',
      conditions: [
        'Fibromyalgia',
        'Chronic Back Pain',
        'Chronic Neck Pain',
        'Left Hip Arthritis',
        'Right Shoulder Rotator Cuff Tear',
        'GERD (Gastroesophageal Reflux Disease)',
        'Irritable Bowel Syndrome (IBS)',
        'Sleep Apnea (Obstructive)'
      ]
    },
    {
      name: 'Combat Veteran - PTSD & Musculoskeletal',
      description: '50% PTSD, spine/hip/knee issues from service',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Lumbar Spine Degenerative Disc Disease',
        'Radiculopathy (Lumbar)',
        'Right Hip Arthritis',
        'Left Hip Arthritis',
        'Tinnitus',
        'Rhinitis (Allergic)'
      ]
    },
    {
      name: 'Diabetes & Complications',
      description: 'Diabetes with common secondary conditions',
      conditions: [
        'Diabetes Mellitus Type II',
        'Diabetic Peripheral Neuropathy',
        'Diabetic Retinopathy',
        'Diabetic Nephropathy',
        'Hypertension (High Blood Pressure)',
        'Erectile Dysfunction',
        'Coronary Artery Disease'
      ]
    },
    {
      name: 'Female Veteran - MST Survivor',
      description: 'Military Sexual Trauma with related mental health and physical conditions',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Major Depressive Disorder',
        'Generalized Anxiety Disorder',
        'Fibromyalgia',
        'Irritable Bowel Syndrome (IBS)',
        'Migraine Headaches',
        'Chronic Pelvic Pain',
        'Sleep Apnea (Obstructive)'
      ]
    },
    {
      name: 'Female Veteran - Musculoskeletal Focus',
      description: 'Common conditions in female veterans from physical demands',
      conditions: [
        'Lumbar Spine Degenerative Disc Disease',
        'Cervical Spine Degenerative Disc Disease',
        'Right Knee Degenerative Arthritis',
        'Left Knee Degenerative Arthritis',
        'Stress Fractures',
        'Right Shoulder Rotator Cuff Tear',
        'Plantar Fasciitis (Bilateral)',
        'Migraine Headaches'
      ]
    },
    {
      name: 'Gulf War Syndrome',
      description: 'Multiple systemic conditions common in Gulf War veterans',
      conditions: [
        'Chronic Fatigue Syndrome',
        'Fibromyalgia',
        'Irritable Bowel Syndrome (IBS)',
        'GERD (Gastroesophageal Reflux Disease)',
        'Migraine Headaches',
        'Peripheral Neuropathy (Idiopathic)',
        'Chronic Pain Syndrome',
        'Functional Gastrointestinal Disorders'
      ]
    },
    {
      name: 'Infantry/Airborne - Joint Cascade',
      description: 'Multiple weight-bearing joint issues from rucking and jumps',
      conditions: [
        'Right Knee Degenerative Arthritis',
        'Left Knee Degenerative Arthritis',
        'Lumbar Spine Degenerative Disc Disease',
        'Right Hip Arthritis',
        'Left Ankle Instability',
        'Right Plantar Fasciitis',
        'Left Plantar Fasciitis',
        'Chronic Back Pain'
      ]
    },
    {
      name: 'LGBTQ+ Veteran',
      description: 'Common conditions in LGBTQ+ veterans - higher rates due to stigma, stress, and discrimination per VA research',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Major Depressive Disorder',
        'Generalized Anxiety Disorder',
        'Substance Use Disorder (in remission)',
        'Sleep Apnea (Obstructive)',
        'Chronic Pain Syndrome',
        'HIV-Related Illness',
        'Hepatitis C'
      ],
      note: 'VA provides LGBTQ+ Veteran Care Coordinators at every facility. If discharged for sexual orientation, you may now be eligible for VA benefits.'
    },
    {
      name: 'LGBTQ+ Veteran - Mental Health Focus',
      description: 'Mental health conditions more prevalent in LGBTQ+ veterans due to minority stress and discrimination',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Major Depressive Disorder',
        'Generalized Anxiety Disorder',
        'Panic Disorder with or without Agoraphobia',
        'Social Anxiety Disorder',
        'Adjustment Disorders',
        'Insomnia Disorder',
        'Substance Use Disorder (in remission)'
      ],
      note: 'LGBTQ+ veterans face unique stressors including concealment during service under past policies. VA research shows higher risk for suicide in this population.'
    },
    {
      name: 'Male Veteran - MST Survivor',
      description: 'Military Sexual Trauma affects all genders - mental health and physical impacts',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Major Depressive Disorder',
        'Generalized Anxiety Disorder',
        'Substance Use Disorder (in remission)',
        'Irritable Bowel Syndrome (IBS)',
        'Erectile Dysfunction',
        'Sleep Apnea (Obstructive)',
        'Chronic Pain Syndrome'
      ]
    },
    {
      name: 'Mental Health Focus',
      description: 'PTSD with common secondary mental health conditions',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Major Depressive Disorder',
        'Generalized Anxiety Disorder',
        'Sleep Apnea (Obstructive)',
        'Migraine Headaches',
        'GERD (Gastroesophageal Reflux Disease)',
        'Erectile Dysfunction'
      ]
    },
    {
      name: 'Navy/Coast Guard - Hearing & Respiratory',
      description: 'Shipboard noise exposure and environmental conditions',
      conditions: [
        'Hearing Loss (Sensorineural)',
        'Tinnitus',
        'Asthma',
        'Sinusitis (Chronic)',
        'Sleep Apnea (Obstructive)',
        'Lumbar Spine Degenerative Disc Disease',
        'Right Knee Degenerative Arthritis',
        'Hypertension (High Blood Pressure)'
      ]
    },
    {
      name: 'PACT Act - Burn Pit Exposure',
      description: 'Post-9/11 toxic exposure conditions (Iraq, Afghanistan, etc.)',
      conditions: [
        'Asthma',
        'Chronic Obstructive Pulmonary Disease (COPD)',
        'Sinusitis (Chronic)',
        'Rhinitis (Allergic)',
        'Sleep Apnea (Obstructive)',
        'GERD (Gastroesophageal Reflux Disease)',
        'Constrictive Bronchiolitis',
        'Interstitial Lung Disease'
      ]
    },
    {
      name: 'Post-Surgical Complications',
      description: 'Joint replacements and surgical residuals',
      conditions: [
        'Right Knee Replacement',
        'Left Knee Replacement',
        'Right Hip Replacement',
        'Lumbar Spine Degenerative Disc Disease',
        'Chronic Pain Syndrome',
        'Right Ankle Arthritis',
        'Peripheral Neuropathy (Idiopathic)'
      ]
    },
    {
      name: 'Spinal Injury with Radiculopathy',
      description: 'Spine conditions with nerve involvement',
      conditions: [
        'Lumbar Spine Degenerative Disc Disease',
        'Radiculopathy (Lumbar)',
        'Spinal Stenosis',
        'Right Hip Arthritis',
        'Left Hip Arthritis',
        'Chronic Back Pain',
        'Peripheral Neuropathy (Idiopathic)',
        'Sciatica'
      ]
    },
    {
      name: 'Transgender Veteran',
      description: 'Conditions common in transgender veterans, including gender dysphoria and related health impacts',
      conditions: [
        'PTSD (Post-Traumatic Stress Disorder)',
        'Major Depressive Disorder',
        'Generalized Anxiety Disorder',
        'Endocrine System Conditions',
        'Sleep Apnea (Obstructive)',
        'Chronic Pain Syndrome',
        'Substance Use Disorder (in remission)',
        'HIV-Related Illness'
      ],
      note: 'VA provides gender-affirming care. Contact your LGBTQ+ Veteran Care Coordinator for support navigating VA services.'
    },
    {
      name: 'Upper Extremity Focus',
      description: 'Shoulder, elbow, and hand injuries',
      conditions: [
        'Right Shoulder Rotator Cuff Tear',
        'Left Shoulder Arthritis',
        'Carpal Tunnel Syndrome (Right)',
        'Carpal Tunnel Syndrome (Left)',
        'Cervical Spine Degenerative Disc Disease',
        'Radiculopathy (Cervical)',
        'TMJ (Temporomandibular Joint) Disorder'
      ]
    }
  ];

  // Create a lookup map from condition names (lowercase) to diagnostic codes
  const conditionToDCCode = useMemo(() => {
    const map = {};
    disabilityData.disabilities.forEach(disability => {
      // Map by condition name (lowercase for case-insensitive lookup)
      map[disability.conditionName.toLowerCase()] = disability.diagnosticCode;
      // Also map by aliases
      if (disability.aliases) {
        disability.aliases.forEach(alias => {
          map[alias.toLowerCase()] = disability.diagnosticCode;
        });
      }
    });
    return map;
  }, []);

  // Helper function to get DC code for a condition
  const getDCCode = (conditionName) => {
    // Try exact match first (case-insensitive)
    const exactMatch = conditionToDCCode[conditionName.toLowerCase()];
    if (exactMatch) return exactMatch;
    
    // Try partial match - find if the condition name contains or is contained in a known condition
    const lowerName = conditionName.toLowerCase();
    for (const [key, code] of Object.entries(conditionToDCCode)) {
      if (lowerName.includes(key) || key.includes(lowerName)) {
        return code;
      }
    }
    return null;
  };

  const toggleCondition = (condition) => {
    setSelectedConditions(prev => 
      prev.includes(condition) 
        ? prev.filter(c => c !== condition)
        : [...prev, condition]
    );
  };

  const toggleSystem = (system) => {
    setExpandedSystems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(system)) {
        newSet.delete(system);
      } else {
        newSet.add(system);
      }
      return newSet;
    });
  };

  const handlePastedRatings = (ratings) => {
    // Save each rating to veteranProfile for global access
    ratings.forEach(rating => {
      addRating({
        id: Date.now() + Math.random(),
        name: rating.condition,
        rating: rating.rating || 0,
        effectiveDate: rating.effectiveDate,
        source: 'VA.gov Import'
      });
    });

    // Reload saved ratings
    const updatedRatings = getMyRatings();
    setSavedRatings(updatedRatings);

    // Extract just the condition names for Secondary Scout
    const conditions = ratings.map(r => r.condition);
    
    // Launch Secondary Scout with these conditions
    if (conditions.length > 0) {
      onLaunch(conditions);
    }
    
    setShowVAGovPaster(false);
  };

  const expandAll = () => {
    setExpandedSystems(new Set(Object.keys(conditionsBySystem)));
  };

  const collapseAll = () => {
    setExpandedSystems(new Set());
  };

  // Filter conditions based on search
  const filteredConditionsBySystem = useMemo(() => {
    if (!searchFilter.trim()) return conditionsBySystem;
    
    const filterLower = searchFilter.toLowerCase();
    const filtered = {};
    
    Object.entries(conditionsBySystem).forEach(([system, conditions]) => {
      const matchingConditions = conditions.filter(c => 
        c.toLowerCase().includes(filterLower)
      );
      const systemMatches = system.toLowerCase().includes(filterLower);
      
      if (matchingConditions.length > 0 || systemMatches) {
        filtered[system] = systemMatches ? conditions : matchingConditions;
      }
    });
    
    return filtered;
  }, [searchFilter, conditionsBySystem]);

  const handleManualSubmit = () => {
    // Parse input - handles both simple list and VA.gov rating format
    // VA.gov format example: "20% rating for radiculopathy, left lower extremity (femoral)"
    const lines = manualInput.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    
    const conditions = lines.map(line => {
      // Check if line matches VA.gov format: "XX% rating for [condition]"
      const vaFormatMatch = line.match(/^\d+%\s+rating\s+for\s+(.+)$/i);
      if (vaFormatMatch) {
        // Extract just the condition name, capitalize properly
        let condition = vaFormatMatch[1].trim();
        // Capitalize first letter of each word for consistency
        condition = condition.replace(/\b\w/g, char => char.toUpperCase());
        return condition;
      }
      // Otherwise return the line as-is (simple format)
      return line;
    }).filter(c => c.length > 0);
    
    if (conditions.length > 0) {
      onLaunch(conditions);
    }
  };

  const handleCheckboxSubmit = () => {
    if (selectedConditions.length > 0) {
      onLaunch(selectedConditions);
    }
  };

  // Handler for My Ratings submission
  const handleMyRatingsSubmit = () => {
    if (savedRatings.length > 0) {
      // Convert saved ratings to condition names for Secondary Scout
      const conditions = savedRatings.map(rating => rating.name);
      onLaunch(conditions);
    }
  };

  // Calculate combined rating from saved ratings using VA math
  const calculateCombinedRating = (ratings) => {
    if (!ratings || ratings.length === 0) return 0;
    const sortedRatings = [...ratings].sort((a, b) => b.rating - a.rating);
    let efficiency = 100;
    sortedRatings.forEach(r => {
      efficiency = efficiency - (efficiency * r.rating / 100);
    });
    const combined = 100 - efficiency;
    return Math.round(combined / 10) * 10; // Round to nearest 10
  };

  const loadExampleProfile = (conditions) => {
    setSelectedConditions(conditions);
    setInputMethod('checkbox');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="secondary-scout-launcher-title"
    >
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col modal-content">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-t-lg flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 id="secondary-scout-launcher-title" className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">🔍 Secondary Scout <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span></h2>
                <p className="text-blue-100 text-sm sm:text-base">
                  Discover potential secondary claims based on your conditions
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Secondary Scout Launcher" />}
                <button
                  onClick={onClose}
                  className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            {/* Input Method Tabs */}
            <div className="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setInputMethod('manual')}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors ${
                  inputMethod === 'manual'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <span className="hidden sm:inline">Type </span>Conditions
              </button>
              <button
                onClick={() => setInputMethod('pdf')}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors ${
                  inputMethod === 'pdf'
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                📄 <span className="hidden sm:inline">Drop-In </span>PDF
              </button>
              <button
                onClick={() => setShowVAGovPaster(true)}
                className="px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 border-b-2 border-transparent hover:border-green-600 dark:hover:border-green-400"
              >
                📋 Paste from VA
              </button>
              <button
                onClick={() => setInputMethod('checkbox')}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors ${
                  inputMethod === 'checkbox'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <span className="hidden sm:inline">Select from </span>List
              </button>
              <button
                onClick={() => setInputMethod('examples')}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors ${
                  inputMethod === 'examples'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Examples
              </button>
              {/* My Ratings Tab - shows only if user has saved ratings */}
              {savedRatings.length > 0 && (
                <button
                  onClick={() => setInputMethod('myratings')}
                  className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors ${
                    inputMethod === 'myratings'
                      ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  ⭐ My Ratings
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded-full">
                    {savedRatings.length}
                  </span>
                </button>
              )}
            </div>

            {/* Manual Input Method */}
            {inputMethod === 'manual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter your service-connected conditions (one per line):
                </label>
                <textarea
                  className="w-full h-56 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Type one condition per line:&#10;&#10;PTSD&#10;Tinnitus&#10;Right Knee Arthritis&#10;Lumbar Spine Strain&#10;Sleep Apnea&#10;&#10;(Need to import from VA.gov? Use 'Paste from VA' tab above)"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={manualInput.trim().length === 0}
                  className="mt-4 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Analyze My Conditions
                </button>
              </div>
            )}

            {/* PDF Drop-In Method */}
            {inputMethod === 'pdf' && (
              <div>
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <h3 className="font-bold text-purple-800 dark:text-purple-200">Drop-In Your VA Decision Letter</h3>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        Drop in a PDF of your VA Rating Decision, Decision Letter, or Benefits Summary to automatically extract your service-connected conditions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Drop Zone */}
                {!pdfFile && !pdfOcrProgress && (
                  <div
                    onDragOver={handlePdfDragOver}
                    onDragLeave={handlePdfDragLeave}
                    onDrop={handlePdfDrop}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                      pdfIsDragging
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
                    }`}
                  >
                    <input
                      ref={pdfFileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                          Drop your PDF here
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          or{' '}
                          <button
                            onClick={() => pdfFileInputRef.current?.click()}
                            className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                          >
                            browse to select
                          </button>
                        </p>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Supports: VA Rating Decision, Decision Letter, Benefits Summary Letter (PDF)
                      </div>
                    </div>
                  </div>
                )}

                {/* OCR Progress */}
                {pdfOcrProgress && (
                  <div className="border border-purple-200 dark:border-purple-700 rounded-xl p-6 bg-purple-50 dark:bg-purple-900/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
                      <span className="font-medium text-purple-800 dark:text-purple-200">
                        {pdfOcrProgress.state === OCR_STATES.LOADING ? 'Loading PDF...' :
                         pdfOcrProgress.state === OCR_STATES.EXTRACTING ? 'Extracting text...' :
                         pdfOcrProgress.state === OCR_STATES.OCR_PROCESSING ? 'Running OCR on scanned pages...' :
                         'Processing...'}
                      </span>
                    </div>
                    {pdfOcrProgress.progress > 0 && (
                      <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${pdfOcrProgress.progress}%` }}
                        />
                      </div>
                    )}
                    {pdfOcrProgress.message && (
                      <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">{pdfOcrProgress.message}</p>
                    )}
                  </div>
                )}

                {/* File Selected + Results */}
                {pdfFile && !pdfOcrProgress && (
                  <div className="border border-purple-200 dark:border-purple-700 rounded-xl p-4 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{pdfFile.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(pdfFile.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemovePdf}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove file"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Error Display */}
                    {pdfError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-700 dark:text-red-300">{pdfError}</p>
                        </div>
                      </div>
                    )}

                    {/* Extracted Conditions */}
                    {extractedPdfConditions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <span className="text-green-500">✓</span>
                          Found {extractedPdfConditions.length} Condition{extractedPdfConditions.length !== 1 ? 's' : ''}
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                          {extractedPdfConditions.map((condition, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg"
                            >
                              <span className="text-green-600 dark:text-green-400">•</span>
                              <span className="text-sm text-gray-800 dark:text-gray-200">{condition}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handlePdfConditionsSubmit}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                        >
                          🔍 Analyze These {extractedPdfConditions.length} Conditions for Secondary Claims
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Privacy Note */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                  🔒 Your PDF is processed locally in your browser - nothing is sent to any server.
                </p>
              </div>
            )}

            {/* Checkbox Selection Method */}
            {inputMethod === 'checkbox' && (
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Select all conditions you currently have service connection for (organized by body system per 38 CFR Part 4, Subpart B):
                </p>
                
                {/* Search Filter */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search conditions (e.g., 'knee', 'PTSD', 'diabetes')..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                    <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchFilter && (
                      <button
                        onClick={() => setSearchFilter('')}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expand/Collapse Controls */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={expandAll}
                    className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
                  >
                    Collapse All
                  </button>
                  {selectedConditions.length > 0 && (
                    <button
                      onClick={() => setSelectedConditions([])}
                      className="text-xs px-3 py-1 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full transition-colors ml-auto"
                    >
                      Clear All Selected
                    </button>
                  )}
                </div>

                <div className="max-h-[280px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {Object.keys(filteredConditionsBySystem).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No conditions found matching "{searchFilter}"</p>
                      <p className="text-sm mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    Object.entries(filteredConditionsBySystem).map(([system, conditions]) => {
                      const isExpanded = expandedSystems.has(system) || searchFilter.trim();
                      const selectedInSystem = conditions.filter(c => selectedConditions.includes(c)).length;
                      
                      return (
                        <div key={system} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                          <button
                            onClick={() => toggleSystem(system)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50 transition-colors"
                          >
                            <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">{system}</span>
                            <div className="flex items-center gap-2">
                              {selectedInSystem > 0 && (
                                <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full">
                                  {selectedInSystem} selected
                                </span>
                              )}
                              <span className="text-gray-400 text-xs">
                                {conditions.length} conditions
                              </span>
                              <svg
                                className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-3 bg-white dark:bg-gray-800">
                              {conditions.map((condition, index) => {
                                // Extract DC code from condition name if present
                                // Matches: (DC 7542), (DC 7542, 7543), (rated under DC 5024), (DC 5003, 5201)
                                const dcMatch = condition.match(/\s*\((?:rated under |rated analogously under )?DC\s*([\d,\s-]+)\)/i);
                                let displayDCCode = null;
                                let displayCondition = condition;
                                
                                if (dcMatch) {
                                  // Extract first DC code number for display
                                  displayDCCode = dcMatch[1].split(/[,\s-]/)[0].trim();
                                  // Remove the exact matched text from display
                                  displayCondition = condition.replace(dcMatch[0], '').trim();
                                } else if (condition.includes('(rated under') || condition.includes('(rated analogously')) {
                                  // Has a "rated under" clause but no specific DC - don't look up, just clean the display
                                  displayCondition = condition.replace(/\s*\(rated under [^)]+\)/gi, '').replace(/\s*\(rated analogously[^)]*\)/gi, '').trim();
                                  displayDCCode = null; // No DC code to show
                                } else {
                                  // Try to look up DC code from disabilityData
                                  displayDCCode = getDCCode(condition);
                                }
                                
                                return (
                                <label
                                  key={`${system}-${index}`}
                                  className={`flex items-start p-2 rounded-lg border cursor-pointer transition-all ${
                                    selectedConditions.includes(condition)
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-sm'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedConditions.includes(condition)}
                                    onChange={() => toggleCondition(condition)}
                                    className="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-blue-600 rounded focus:ring-blue-500"
                                  />
                                  <span className={`text-xs ${
                                    selectedConditions.includes(condition) ? 'text-blue-900 dark:text-blue-100 font-medium' : 'text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {displayDCCode && <span className="text-gray-400 dark:text-gray-500 mr-1">DC {displayDCCode}</span>}
                                    {displayCondition}
                                  </span>
                                </label>
                              );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Summary */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Selected:</strong> {selectedConditions.length} condition{selectedConditions.length !== 1 ? 's' : ''}
                    </p>
                    {selectedConditions.length > 0 && (
                      <button
                        onClick={() => setExpandedSystems(new Set())}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        View selected
                      </button>
                    )}
                  </div>
                  {selectedConditions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {selectedConditions.map((condition, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                        >
                          {condition}
                          <button
                            onClick={() => toggleCondition(condition)}
                            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCheckboxSubmit}
                  disabled={selectedConditions.length === 0}
                  className="mt-4 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Analyze My Conditions ({selectedConditions.length} selected)
                </button>
              </div>
            )}

            {/* Example Profiles Method */}
            {inputMethod === 'examples' && (
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Choose a sample veteran profile to see how Secondary Scout works:
                </p>
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                  {exampleProfiles.map((profile, index) => (
                    <button
                      key={index}
                      onClick={() => loadExampleProfile(profile.conditions)}
                      className="w-full text-left p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all group"
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {profile.name}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 italic">
                        {profile.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.conditions.slice(0, 5).map((condition, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full"
                          >
                            {condition}
                          </span>
                        ))}
                        {profile.conditions.length > 5 && (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 text-xs rounded-full font-semibold">
                            +{profile.conditions.length - 5} more
                          </span>
                        )}
                      </div>
                      {profile.note && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-purple-700 dark:text-purple-300 flex items-start gap-1">
                            <span className="shrink-0">💡</span>
                            <span>{profile.note}</span>
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* My Ratings Method */}
            {inputMethod === 'myratings' && (
              <div>
                <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">⭐</span>
                    <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200">Your Saved Ratings</h3>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    These are your actual VA disability ratings saved from the Tactical Calculator. 
                    Use them to find potential secondary conditions!
                  </p>
                  {savedRatings.length > 0 && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Combined Rating: 
                      </span>
                      <span className="px-3 py-1 bg-yellow-600 text-white font-bold rounded-full">
                        {calculateCombinedRating(savedRatings)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  {savedRatings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <span className="text-4xl mb-3 block">📭</span>
                      <p className="font-medium">No saved ratings found</p>
                      <p className="text-sm mt-1">
                        Use the <strong>Tactical Calculator</strong> to save your VA disability ratings
                      </p>
                    </div>
                  ) : (
                    savedRatings.map((rating, index) => (
                      <div 
                        key={rating.id || index}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-bold rounded ${
                              rating.rating >= 70 ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                              rating.rating >= 40 ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' :
                              rating.rating >= 20 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                              'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                            }`}>
                              {rating.rating}%
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {rating.name}
                            </span>
                          </div>
                          {(rating.bodyPart || rating.side) && (
                            <div className="flex gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {rating.bodyPart && <span>📍 {rating.bodyPart}</span>}
                              {rating.side && <span>↔️ {rating.side}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {savedRatings.length > 0 && (
                  <button
                    onClick={handleMyRatingsSubmit}
                    className="mt-4 w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                  >
                    🔍 Analyze My {savedRatings.length} Rating{savedRatings.length !== 1 ? 's' : ''} for Secondary Conditions
                  </button>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-100">
                    <strong>Important:</strong> This tool is educational and based on 38 CFR § 3.310 (Secondary Service Connection). 
                    Suggestions should be reviewed with a VA-accredited representative and require a medical nexus opinion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VA.gov Rating Paster Modal */}
      {showVAGovPaster && (
        <VAGovRatingPaster
          onRatingsParsed={handlePastedRatings}
          onClose={() => setShowVAGovPaster(false)}
          showExample={true}
        />
      )}
    </div>
  );
};

export default SecondaryScoutLauncher;
