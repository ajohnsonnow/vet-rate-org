import React, { useState, useMemo } from 'react';
import ReportBugLink from './ReportBugLink';

/**
 * SecondaryScoutLauncher Component
 * Allows users to select their conditions before launching the Secondary Scout
 * Organized by body system per 38 CFR Part 4, Subpart B - Schedule for Rating Disabilities
 */
const SecondaryScoutLauncher = ({ onLaunch, onClose, onReportBug }) => {
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'examples'
  const [manualInput, setManualInput] = useState('');
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedSystems, setExpandedSystems] = useState(new Set());

  // Organized by body system per 38 CFR Part 4, Subpart B - Schedule for Rating Disabilities
  const conditionsBySystem = {
    // ═══════════════════════════════════════════════════════════════════
    // MUSCULOSKELETAL SYSTEM (§§ 4.40-4.73)
    // ═══════════════════════════════════════════════════════════════════
    '🦴 Musculoskeletal - Spine (DC 5235-5243)': [
      'Cervical Spine Degenerative Disc Disease',
      'Cervical Strain',
      'Cervical Spondylosis',
      'Thoracic Spine Strain',
      'Thoracolumbar Spine DDD',
      'Lumbar Spine Degenerative Disc Disease',
      'Lumbosacral Strain',
      'Spinal Stenosis',
      'Spondylolisthesis',
      'Segmental Instability',
      'Ankylosing Spondylitis',
      'Spinal Fusion',
      'Intervertebral Disc Syndrome (IVDS)',
      'Vertebral Fracture or Dislocation',
      'Sacroiliac Injury and Weakness',
      'Chronic Back Pain',
      'Chronic Neck Pain',
      'Radiculopathy (Cervical)',
      'Radiculopathy (Lumbar)',
      'Sciatica'
    ],
    '🦴 Musculoskeletal - Shoulder & Arm (DC 5200-5203)': [
      'Right Shoulder Limitation of Motion',
      'Left Shoulder Limitation of Motion',
      'Right Shoulder Rotator Cuff Tear',
      'Left Shoulder Rotator Cuff Tear',
      'Right Shoulder Arthritis',
      'Left Shoulder Arthritis',
      'Right Shoulder Impingement Syndrome',
      'Left Shoulder Impingement Syndrome',
      'Right Shoulder Instability',
      'Left Shoulder Instability',
      'Right Shoulder Ankylosis',
      'Left Shoulder Ankylosis',
      'Right Humerus Impairment',
      'Left Humerus Impairment',
      'Right Clavicle/Scapula Impairment',
      'Left Clavicle/Scapula Impairment',
      'Right Shoulder Replacement',
      'Left Shoulder Replacement'
    ],
    '🦴 Musculoskeletal - Elbow & Forearm (DC 5205-5213)': [
      'Right Elbow Limitation of Motion',
      'Left Elbow Limitation of Motion',
      'Right Elbow Arthritis',
      'Left Elbow Arthritis',
      'Right Elbow Ankylosis',
      'Left Elbow Ankylosis',
      'Right Radius/Ulna Impairment',
      'Left Radius/Ulna Impairment',
      'Right Elbow Replacement',
      'Left Elbow Replacement',
      'Right Lateral Epicondylitis (Tennis Elbow)',
      'Left Lateral Epicondylitis (Tennis Elbow)',
      'Right Medial Epicondylitis (Golfer\'s Elbow)',
      'Left Medial Epicondylitis (Golfer\'s Elbow)'
    ],
    '🦴 Musculoskeletal - Wrist & Hand (DC 5214-5230)': [
      'Right Wrist Limitation of Motion',
      'Left Wrist Limitation of Motion',
      'Right Wrist Arthritis',
      'Left Wrist Arthritis',
      'Right Wrist Ankylosis',
      'Left Wrist Ankylosis',
      'Carpal Tunnel Syndrome (Right)',
      'Carpal Tunnel Syndrome (Left)',
      'Right Hand Injury',
      'Left Hand Injury',
      'Right Thumb Limitation of Motion',
      'Left Thumb Limitation of Motion',
      'Right Finger(s) Limitation of Motion',
      'Left Finger(s) Limitation of Motion',
      'Right Trigger Finger',
      'Left Trigger Finger',
      'Dupuytren\'s Contracture (Right)',
      'Dupuytren\'s Contracture (Left)',
      'De Quervain\'s Tenosynovitis (Right)',
      'De Quervain\'s Tenosynovitis (Left)'
    ],
    '🦴 Musculoskeletal - Hip & Thigh (DC 5250-5255)': [
      'Right Hip Limitation of Motion',
      'Left Hip Limitation of Motion',
      'Right Hip Arthritis',
      'Left Hip Arthritis',
      'Right Hip Ankylosis',
      'Left Hip Ankylosis',
      'Right Hip Flail Joint',
      'Left Hip Flail Joint',
      'Right Femur Impairment',
      'Left Femur Impairment',
      'Right Hip Replacement',
      'Left Hip Replacement',
      'Right Greater Trochanteric Pain Syndrome',
      'Left Greater Trochanteric Pain Syndrome',
      'Right Hip Bursitis',
      'Left Hip Bursitis'
    ],
    '🦴 Musculoskeletal - Knee & Leg (DC 5256-5263)': [
      'Right Knee Limitation of Motion (Flexion)',
      'Left Knee Limitation of Motion (Flexion)',
      'Right Knee Limitation of Motion (Extension)',
      'Left Knee Limitation of Motion (Extension)',
      'Right Knee Degenerative Arthritis',
      'Left Knee Degenerative Arthritis',
      'Right Knee Ankylosis',
      'Left Knee Ankylosis',
      'Right Knee Instability',
      'Left Knee Instability',
      'Right Knee Meniscal Tear',
      'Left Knee Meniscal Tear',
      'Right Knee Cartilage Removal',
      'Left Knee Cartilage Removal',
      'Right Knee Replacement',
      'Left Knee Replacement',
      'Right Tibia/Fibula Impairment',
      'Left Tibia/Fibula Impairment',
      'Right Patellofemoral Syndrome',
      'Left Patellofemoral Syndrome',
      'Right Shin Splints',
      'Left Shin Splints'
    ],
    '🦴 Musculoskeletal - Ankle & Foot (DC 5270-5284)': [
      'Right Ankle Limitation of Motion',
      'Left Ankle Limitation of Motion',
      'Right Ankle Arthritis',
      'Left Ankle Arthritis',
      'Right Ankle Ankylosis',
      'Left Ankle Ankylosis',
      'Right Ankle Instability',
      'Left Ankle Instability',
      'Right Foot Injury',
      'Left Foot Injury',
      'Right Plantar Fasciitis',
      'Left Plantar Fasciitis',
      'Right Pes Planus (Flat Feet)',
      'Left Pes Planus (Flat Feet)',
      'Bilateral Pes Planus (Flat Feet)',
      'Right Hallux Valgus (Bunion)',
      'Left Hallux Valgus (Bunion)',
      'Right Hallux Rigidus',
      'Left Hallux Rigidus',
      'Right Hammer Toes',
      'Left Hammer Toes',
      'Right Morton\'s Neuroma',
      'Left Morton\'s Neuroma',
      'Right Achilles Tendinitis',
      'Left Achilles Tendinitis',
      'Right Tarsal Tunnel Syndrome',
      'Left Tarsal Tunnel Syndrome'
    ],
    '🦴 Musculoskeletal - Systemic/Arthritis (DC 5000-5025)': [
      'Osteomyelitis',
      'Multi-Joint Arthritis (Rheumatoid)',
      'Degenerative Arthritis (Osteoarthritis)',
      'Post-Traumatic Arthritis',
      'Psoriatic Arthritis',
      'Fibromyalgia',
      'Gout',
      'Bursitis',
      'Tendonitis/Tenosynovitis',
      'Myositis',
      'Chronic Pain Syndrome',
      'Complex Regional Pain Syndrome (CRPS)'
    ],
    '🦴 Musculoskeletal - Muscle Injuries (DC 5301-5329)': [
      'Muscle Injury - Shoulder Girdle (Group I-IV)',
      'Muscle Injury - Arm (Group V-VI)',
      'Muscle Injury - Forearm/Hand (Group VII-IX)',
      'Muscle Injury - Foot/Leg (Group X-XII)',
      'Muscle Injury - Thigh/Pelvis (Group XIII-XVIII)',
      'Muscle Injury - Torso/Neck (Group XIX-XXIII)',
      'Muscle Hernia',
      'Rhabdomyolysis Residuals',
      'Compartment Syndrome'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // ORGANS OF SPECIAL SENSE - EYE (§§ 4.75-4.79)
    // ═══════════════════════════════════════════════════════════════════
    '👁️ Eye Conditions (DC 6000-6091)': [
      'Cataracts',
      'Glaucoma',
      'Macular Degeneration',
      'Diabetic Retinopathy',
      'Retinal Detachment',
      'Uveitis/Iritis',
      'Keratitis',
      'Scleritis',
      'Conjunctivitis (Chronic)',
      'Dry Eye Syndrome',
      'Ptosis',
      'Diplopia (Double Vision)',
      'Visual Field Loss',
      'Visual Acuity Loss',
      'Eye Injury Residuals',
      'Optic Neuritis',
      'Corneal Dystrophy',
      'Ectropion/Entropion'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // IMPAIRMENT OF AUDITORY ACUITY (§§ 4.85-4.87a)
    // ═══════════════════════════════════════════════════════════════════
    '👂 Ear & Hearing (DC 6100-6276)': [
      'Hearing Loss (Sensorineural)',
      'Hearing Loss (Conductive)',
      'Hearing Loss (Mixed)',
      'Tinnitus',
      'Meniere\'s Disease',
      'Vertigo',
      'Labyrinthitis',
      'Otitis Media (Chronic)',
      'Otitis Externa (Chronic)',
      'Cholesteatoma',
      'Perforation of Tympanic Membrane',
      'Otosclerosis',
      'Loss of Auricle',
      'Hyperacusis',
      'Loss of Sense of Smell',
      'Loss of Sense of Taste'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // INFECTIOUS DISEASES, IMMUNE DISORDERS & NUTRITIONAL DEFICIENCIES (§§ 4.88-4.89)
    // ═══════════════════════════════════════════════════════════════════
    '🦠 Infectious & Immune Disorders (DC 6300-6354)': [
      'Chronic Fatigue Syndrome',
      'Lupus Erythematosus (Systemic)',
      'HIV-Related Illness',
      'Lyme Disease',
      'Tuberculosis (Pulmonary)',
      'Tuberculosis (Non-Pulmonary)',
      'Hepatitis B',
      'Hepatitis C',
      'Malaria Residuals',
      'Brucellosis',
      'West Nile Virus Residuals',
      'Gulf War Presumptive Conditions',
      'Fibromyalgia'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // RESPIRATORY SYSTEM (§§ 4.96-4.97)
    // ═══════════════════════════════════════════════════════════════════
    '🫁 Respiratory System (DC 6502-6847)': [
      'Deviated Nasal Septum',
      'Sinusitis (Chronic)',
      'Rhinitis (Allergic)',
      'Rhinitis (Vasomotor)',
      'Laryngitis (Chronic)',
      'Aphonia',
      'Stenosis of Larynx',
      'Asthma',
      'Chronic Obstructive Pulmonary Disease (COPD)',
      'Chronic Bronchitis',
      'Emphysema',
      'Bronchiectasis',
      'Pulmonary Fibrosis',
      'Restrictive Lung Disease',
      'Pneumoconiosis',
      'Asbestosis',
      'Sarcoidosis',
      'Sleep Apnea (Obstructive)',
      'Sleep Apnea (Central)',
      'Pleural Effusion',
      'Pulmonary Hypertension',
      'Residuals of Lung Surgery'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // CARDIOVASCULAR SYSTEM (§§ 4.100-4.104)
    // ═══════════════════════════════════════════════════════════════════
    '❤️ Cardiovascular System (DC 7000-7124)': [
      'Hypertension (High Blood Pressure)',
      'Ischemic Heart Disease',
      'Coronary Artery Disease',
      'Arteriosclerotic Heart Disease',
      'Myocardial Infarction Residuals',
      'Cardiomyopathy',
      'Valvular Heart Disease',
      'Arrhythmia/Atrial Fibrillation',
      'Heart Failure (Congestive)',
      'Pericarditis',
      'Endocarditis',
      'Cardiac Pacemaker',
      'Aortic Aneurysm',
      'Peripheral Arterial Disease',
      'Peripheral Vascular Disease',
      'Varicose Veins',
      'Deep Vein Thrombosis (DVT)',
      'Post-Phlebitic Syndrome',
      'Raynaud\'s Syndrome/Disease',
      'Cold Injury Residuals',
      'Arteriovenous Fistula',
      'Lymphedema'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // DIGESTIVE SYSTEM (§§ 4.110-4.114)
    // ═══════════════════════════════════════════════════════════════════
    '🍽️ Digestive System (DC 7200-7357)': [
      'GERD (Gastroesophageal Reflux Disease)',
      'Hiatal Hernia',
      'Esophageal Stricture',
      'Barrett\'s Esophagus',
      'Peptic Ulcer Disease',
      'Gastritis (Chronic)',
      'Gastroparesis',
      'Post-Gastrectomy Syndrome',
      'Irritable Bowel Syndrome (IBS)',
      'Crohn\'s Disease',
      'Ulcerative Colitis',
      'Diverticulitis/Diverticulosis',
      'Intestinal Resection',
      'Peritoneal Adhesions',
      'Hemorrhoids',
      'Anal Fissure',
      'Fecal Incontinence',
      'Cirrhosis of Liver',
      'Chronic Liver Disease',
      'Chronic Pancreatitis',
      'Cholecystitis (Gallbladder)',
      'Cholelithiasis (Gallstones)',
      'Hepatitis (Chronic)',
      'Inguinal Hernia',
      'Ventral/Incisional Hernia',
      'Celiac Disease',
      'Malabsorption Syndrome'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // GENITOURINARY SYSTEM (§§ 4.115-4.115b)
    // ═══════════════════════════════════════════════════════════════════
    '🫘 Genitourinary System (DC 7500-7542)': [
      'Chronic Kidney Disease',
      'Renal Dysfunction',
      'Kidney Removal (Nephrectomy)',
      'Kidney Stones (Nephrolithiasis)',
      'Hydronephrosis',
      'Chronic Pyelonephritis',
      'Nephritis (Chronic)',
      'Ureter Stricture',
      'Cystitis (Chronic)',
      'Bladder Stones',
      'Bladder Dysfunction',
      'Urinary Incontinence',
      'Urinary Frequency',
      'Urinary Tract Infections (Recurrent)',
      'Prostate Cancer',
      'Benign Prostatic Hyperplasia (BPH)',
      'Prostatitis (Chronic)',
      'Erectile Dysfunction',
      'Testicular Atrophy',
      'Kidney Transplant',
      'Dialysis Requirement'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // GYNECOLOGICAL CONDITIONS (§§ 4.116)
    // ═══════════════════════════════════════════════════════════════════
    '♀️ Gynecological Conditions (DC 7610-7631)': [
      'Endometriosis',
      'Ovarian Cysts',
      'Uterine Fibroids',
      'Pelvic Inflammatory Disease',
      'Cervical Disease/Injury',
      'Hysterectomy Residuals',
      'Ovary Removal Residuals',
      'Vulvovaginitis',
      'Menstrual Disorders',
      'Breast Disease/Injury',
      'Mastectomy Residuals'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // HEMATOLOGIC AND LYMPHATIC SYSTEMS (§ 4.117)
    // ═══════════════════════════════════════════════════════════════════
    '🩸 Hematologic & Lymphatic (DC 7700-7725)': [
      'Anemia (Various Types)',
      'Sickle Cell Disease',
      'Leukemia',
      'Lymphoma (Hodgkin\'s)',
      'Lymphoma (Non-Hodgkin\'s)',
      'Multiple Myeloma',
      'Polycythemia Vera',
      'Thrombocytopenia',
      'Splenectomy Residuals',
      'Spleen Injury',
      'Lymph Node Removal',
      'Immune Thrombocytopenia (ITP)',
      'Bone Marrow Transplant Residuals',
      'Aplastic Anemia',
      'Hemophilia'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // SKIN CONDITIONS (§ 4.118)
    // ═══════════════════════════════════════════════════════════════════
    '🧴 Skin Conditions (DC 7800-7833)': [
      'Burn Scars (Head/Face/Neck)',
      'Burn Scars (Body)',
      'Scars (Disfiguring)',
      'Scars (Unstable)',
      'Scars (Painful)',
      'Dermatitis/Eczema',
      'Psoriasis',
      'Acne/Chloracne',
      'Tinea (Fungal Infections)',
      'Urticaria (Hives)',
      'Hyperhidrosis',
      'Alopecia',
      'Vitiligo',
      'Skin Cancer (Malignant)',
      'Benign Skin Neoplasms',
      'Bullous Disorders',
      'Lupus Erythematosus (Cutaneous)',
      'Erythroderma',
      'Hidradenitis Suppurativa',
      'Leishmaniasis (Cutaneous)'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // ENDOCRINE SYSTEM (§ 4.119)
    // ═══════════════════════════════════════════════════════════════════
    '⚗️ Endocrine System (DC 7900-7919)': [
      'Diabetes Mellitus Type I',
      'Diabetes Mellitus Type II',
      'Diabetic Nephropathy',
      'Diabetic Retinopathy',
      'Diabetic Peripheral Neuropathy',
      'Hypothyroidism',
      'Hyperthyroidism (Graves\' Disease)',
      'Thyroiditis',
      'Thyroid Nodules/Goiter',
      'Hyperparathyroidism',
      'Hypoparathyroidism',
      'Cushing\'s Syndrome',
      'Addison\'s Disease',
      'Acromegaly',
      'Pituitary Tumor/Dysfunction',
      'Adrenal Gland Dysfunction',
      'Pheochromocytoma'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // NEUROLOGICAL CONDITIONS (§§ 4.120-4.124a)
    // ═══════════════════════════════════════════════════════════════════
    '🧠 Neurological - Brain & Central Nervous (DC 8000-8046)': [
      'Traumatic Brain Injury (TBI)',
      'Epilepsy/Seizure Disorder (Grand Mal)',
      'Epilepsy/Seizure Disorder (Petit Mal)',
      'Multiple Sclerosis',
      'Parkinson\'s Disease',
      'Migraine Headaches',
      'Tension Headaches',
      'Cluster Headaches',
      'Stroke Residuals (CVA)',
      'Brain Tumor Residuals',
      'Meningitis Residuals',
      'Encephalitis Residuals',
      'ALS (Amyotrophic Lateral Sclerosis)',
      'Syringomyelia',
      'Dementia',
      'Narcolepsy',
      'Myasthenia Gravis',
      'Essential Tremor',
      'Huntington\'s Disease'
    ],
    '🧠 Neurological - Cranial Nerves (DC 8205-8412)': [
      'Trigeminal Neuralgia (5th Cranial)',
      'Facial Nerve Paralysis (Bell\'s Palsy)',
      'Glossopharyngeal Neuralgia',
      'Vagus Nerve Dysfunction',
      'Spinal Accessory Nerve Injury',
      'Hypoglossal Nerve Injury'
    ],
    '🧠 Neurological - Peripheral Nerves (DC 8510-8730)': [
      'Peripheral Neuropathy (Diabetic)',
      'Peripheral Neuropathy (Toxic)',
      'Peripheral Neuropathy (Idiopathic)',
      'Radiculopathy (Cervical)',
      'Radiculopathy (Lumbar)',
      'Sciatica',
      'Median Nerve (Carpal Tunnel)',
      'Ulnar Nerve Entrapment',
      'Radial Nerve Injury',
      'Musculocutaneous Nerve Injury',
      'Sciatic Nerve Injury',
      'Femoral Nerve Injury',
      'Peroneal (Common) Nerve Injury',
      'Tibial Nerve Injury',
      'Pudendal Neuralgia',
      'Long Thoracic Nerve Injury',
      'Brachial Plexus Injury',
      'Lumbosacral Plexus Injury',
      'Small Fiber Neuropathy'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // MENTAL DISORDERS (§§ 4.125-4.130)
    // ═══════════════════════════════════════════════════════════════════
    '🧩 Mental Health - Trauma & Stressor (DC 9400-9440)': [
      'PTSD (Post-Traumatic Stress Disorder)',
      'Acute Stress Disorder',
      'Adjustment Disorder',
      'Prolonged Grief Disorder',
      'Dissociative Disorders'
    ],
    '🧩 Mental Health - Mood Disorders': [
      'Major Depressive Disorder',
      'Persistent Depressive Disorder (Dysthymia)',
      'Bipolar I Disorder',
      'Bipolar II Disorder',
      'Cyclothymic Disorder'
    ],
    '🧩 Mental Health - Anxiety Disorders': [
      'Generalized Anxiety Disorder',
      'Panic Disorder',
      'Social Anxiety Disorder',
      'Specific Phobias',
      'Agoraphobia'
    ],
    '🧩 Mental Health - Other': [
      'Obsessive-Compulsive Disorder (OCD)',
      'Somatic Symptom Disorder',
      'Illness Anxiety Disorder',
      'Schizophrenia',
      'Schizoaffective Disorder',
      'Delusional Disorder',
      'Eating Disorders',
      'Insomnia Disorder',
      'Substance Use Disorders',
      'Neurocognitive Disorders'
    ],
    // ═══════════════════════════════════════════════════════════════════
    // DENTAL AND ORAL CONDITIONS (§§ 4.149-4.150)
    // ═══════════════════════════════════════════════════════════════════
    '🦷 Dental & Oral Conditions (DC 9900-9916)': [
      'TMJ (Temporomandibular Joint) Disorder',
      'Loss of Teeth',
      'Maxilla/Mandible Loss',
      'Loss of Maxilla/Mandible Substance',
      'Osteomyelitis (Jaw)',
      'Osteoradionecrosis',
      'Loss of Hard Palate',
      'Oral/Pharyngeal Cancer Residuals',
      'Bruxism'
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
      name: 'Women Veteran - MST Survivor',
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
      name: 'Women Veteran - Musculoskeletal Focus',
      description: 'Common conditions in women veterans from physical demands',
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
    }
  ];

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

  const loadExampleProfile = (conditions) => {
    setSelectedConditions(conditions);
    setInputMethod('checkbox');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="secondary-scout-launcher-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-6 py-6 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="secondary-scout-launcher-title" className="text-3xl font-bold mb-2">Secondary Scout</h2>
                <p className="text-blue-100">
                  Discover potential secondary claims based on your service-connected disabilities
                </p>
              </div>
              <div className="flex items-center gap-3">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Secondary Scout Launcher" />}
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {/* Input Method Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setInputMethod('manual')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  inputMethod === 'manual'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Type Your Conditions
              </button>
              <button
                onClick={() => setInputMethod('checkbox')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  inputMethod === 'checkbox'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Select from List
              </button>
              <button
                onClick={() => setInputMethod('examples')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  inputMethod === 'examples'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Example Profiles
              </button>
            </div>

            {/* Manual Input Method */}
            {inputMethod === 'manual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter your service-connected conditions (one per line):
                </label>
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    <strong>💡 Pro Tip:</strong> You can copy/paste directly from your VA.gov rating page!
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                    Go to{' '}
                    <a 
                      href="https://www.va.gov/disability/view-disability-rating/rating" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                      VA.gov Rating Page
                    </a>
                    , copy your conditions list, and paste it below. The tool will automatically parse lines like:
                  </p>
                  <code className="text-xs bg-blue-100 dark:bg-blue-800/50 px-2 py-1 rounded block text-blue-900 dark:text-blue-200">
                    20% rating for radiculopathy, left lower extremity (femoral)
                  </code>
                </div>
                <textarea
                  className="w-full h-56 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Paste from VA.gov or type manually:&#10;&#10;20% rating for PTSD&#10;10% rating for tinnitus&#10;&#10;- OR just list conditions: -&#10;&#10;PTSD&#10;Tinnitus&#10;Right Knee Arthritis"
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
                            <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-300">{system}</span>
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
                              {conditions.map((condition, index) => (
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
                                    className="mt-0.5 mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                  />
                                  <span className={`text-xs ${
                                    selectedConditions.includes(condition) ? 'text-blue-900 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {condition}
                                  </span>
                                </label>
                              ))}
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
                    </button>
                  ))}
                </div>
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
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>Important:</strong> This tool is educational and based on 38 CFR § 3.310 (Secondary Service Connection). 
                    Suggestions should be reviewed with a VA-accredited representative and require a medical nexus opinion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecondaryScoutLauncher;
