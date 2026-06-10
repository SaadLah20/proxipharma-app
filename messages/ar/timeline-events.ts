export const timelineEventsAr = {
  line: {
    origin_patient_request: {
      patient: {
        patient_requested: "منتج مطلوب",
        prescription_pharmacist_sourced: "منتج أدخلته الصيدلية",
        pharmacist_proposed_in_response: "منتج مطلوب",
        added_after_confirm: "منتج مطلوب",
      },
      pharmacist: {
        patient_requested: "منتج طلبه المريض",
        prescription_pharmacist_sourced: "منتج أُدخل من الوصفة",
        pharmacist_proposed_in_response: "منتج طلبه المريض",
        added_after_confirm: "منتج طلبه المريض",
      },
    },
    origin_patient_request_updated: {
      patient: {
        patient_requested: "تم تعديل الطلب",
        prescription_pharmacist_sourced: "تم تعديل الإدخال من الصيدلية",
        pharmacist_proposed_in_response: "تم تعديل الطلب",
        added_after_confirm: "تم تعديل الطلب",
      },
      pharmacist: {
        patient_requested: "عدّل المريض الطلب",
        prescription_pharmacist_sourced: "تم تعديل إدخال الوصفة",
        pharmacist_proposed_in_response: "عدّل المريض الطلب",
        added_after_confirm: "عدّل المريض الطلب",
      },
    },
    origin_pharmacist_proposed: {
      patient: "مقترح من الصيدلية",
      pharmacist: "منتج مقترح من الصيدلية",
    },
    pharmacist_response: {
      patient: {
        patient_requested: "رد على طلبك",
        prescription_pharmacist_sourced: "رد على هذا المنتج",
        pharmacist_proposed_in_response: "رد على طلبك",
        added_after_confirm: "رد على طلبك",
      },
      pharmacist: {
        patient_requested: "تم نشر الرد على هذا المنتج",
        prescription_pharmacist_sourced: "تم نشر الرد على هذا المنتج",
        pharmacist_proposed_in_response: "تم نشر الرد على هذا المنتج",
        added_after_confirm: "تم نشر الرد على هذا المنتج",
      },
    },
    pharmacist_response_updated_line: {
      patient: "تم تحديث الرد",
      pharmacist: "تم تعديل الرد على هذا المنتج",
    },
    patient_validation_kept: {
      patient: {
        patient_requested: "احتفظت به",
        prescription_pharmacist_sourced: "احتفظت به",
        pharmacist_proposed_in_response: "تم قبوله في طلبك",
        added_after_confirm: "احتفظت به",
      },
      pharmacist: {
        patient_requested: "اختاره المريض",
        prescription_pharmacist_sourced: "اختاره المريض",
        pharmacist_proposed_in_response: "قبله المريض",
        added_after_confirm: "اختاره المريض",
      },
    },
    patient_validation_skipped: {
      patient: {
        patient_requested: "غير مختار من طرفك",
        prescription_pharmacist_sourced: "غير مختار من طرفك",
        pharmacist_proposed_in_response: "غير مقبول",
        added_after_confirm: "غير مختار من طرفك",
      },
      pharmacist: {
        patient_requested: "غير مختار",
        prescription_pharmacist_sourced: "غير مختار",
        pharmacist_proposed_in_response: "رفضه المريض",
        added_after_confirm: "غير مختار",
      },
    },
    patient_validation_updated: {
      patient: "تم تعديل التأكيد",
      pharmacist: "تم تعديل تأكيد المريض",
    },
    amend_withdraw_after_confirm: {
      patient: "أزيل من طلبك",
      pharmacist: "تم سحب المنتج",
    },
    withdraw_auto_at_closure: {
      patient: "أزيل من طلبك",
      pharmacist: "تم سحب المنتج",
    },
    withdraw_inferred: {
      patient: "أزيل من طلبك",
      pharmacist: "تم سحب المنتج",
    },
    amend_reintegrate: {
      patient: "عاد إلى طلبك",
      pharmacist: "أُعيد إدماجه في الملف",
    },
    amend_validated_qty_change: {
      patient: "تم تعديل الكمية المؤكدة",
      pharmacist: "تم تعديل الكمية المؤكدة",
    },
    amend_line_added_after_confirm: {
      patient: "أضيف بموافقتك",
      pharmacist: "أُضيف بعد التأكيد",
    },
    amend_line_removed_after_confirm: {
      patient: "سحبته الصيدلية",
      pharmacist: "تم سحب المقترح",
    },
    amend_line_brought_to_reserve: {
      patient: "حُجز في الصيدلية",
      pharmacist: "نُقل إلى الحجز",
    },
    amend_line_adjust_supply: {
      patient: "تحديث التوفر",
      pharmacist: "تم تعديل التوفر",
    },
    amend_other: {
      patient: "تم تسجيل التحديث",
      pharmacist: "تم تسجيل التعديل",
    },
    legacy_audit_adjustment: {
      patient: "تحديث بعد التأكيد",
      pharmacist: "تعديل بعد التأكيد",
    },
    counter_picked_up: {
      patient: "تم الاستلام عند الصندوق",
      pharmacist: "تم الاستلام عند الصندوق",
    },
    counter_unset: {
      patient: "بانتظار الزيارة",
      pharmacist: "أعيدت المتابعة إلى الانتظار",
    },
    counter_cancelled: {
      patient: "لم يُستلم عند الصندوق",
      pharmacist: "لم يُستلم عند الصندوق",
    },
    counter_other: {
      patient: "تحديث على الصندوق",
      pharmacist: "تحديث الصندوق",
    },
    dossier_line_note: {
      patient: "تحديث على هذا المنتج",
      pharmacist: "ملاحظة على هذا المنتج",
    },
    epilogue_active: {
      patient: "أين وصل",
      pharmacist: "الوضع الحالي",
    },
    epilogue_archived: {
      patient: "الخلاصة",
      pharmacist: "الحالة النهائية",
    },
    fallback: {
      patient: "تحديث",
      pharmacist: "حدث",
    },
  },
  dossier: {
    sameStatus: {
      publication_disponibilites: {
        patient: "نشرت الصيدلية ردها",
        pharmacist: "تم نشر الرد للمريض",
      },
      patient_confirm_after_response: {
        patient: "أكّدت طلبك",
        pharmacist: "أكّد المريض طلبه",
      },
      patient_planned_visit_updated: {
        patient: "عدّلت تاريخ زيارتك",
        pharmacist: "تم تعديل تاريخ الزيارة",
      },
      patient_update_planned_visit_after_confirmation: {
        patient: "عدّلت تاريخ زيارتك",
        pharmacist: "تم تعديل تاريخ الزيارة",
      },
      patient_resubmit_product_request_after_response: {
        patient: "أعدت إرسال قائمة منتجات محدثة",
        pharmacist: "أعاد المريض إرسال قائمة المنتجات",
      },
      pharmacist_response_updated: {
        patient: "عدّلت الصيدلية ردها",
        pharmacist: "تم تعديل الرد قبل تأكيد المريض",
      },
      pharmacist_adjustments_after_confirmation: {
        patient: "عدّلت الصيدلية طلبك المؤكد",
        pharmacist: "تعديلات بعد تأكيد المريض",
      },
      pharmacist_supply_amendments_saved: {
        patient: "حدّثت الصيدلية طلبك",
        pharmacist: "تم تسجيل التعديلات بموافقة المريض",
      },
      pharmacist_proposed_line_removed: {
        patient: "سحبت الصيدلية اقتراحاً",
        pharmacist: "تم سحب اقتراح منتج",
      },
      counter_product_added: {
        patient: "أُضيف منتج إلى متابعة الصندوق",
        pharmacist: "أُضيف منتج إلى متابعة الصندوق",
      },
      counter_alternative_added: {
        patient: "أُضيف بديل",
        pharmacist: "أُضيف بديل",
      },
      counter_alternative_removed: {
        patient: "أُزيل بديل",
        pharmacist: "أُزيل بديل",
      },
      pharmacist_ui_confirm_close: {
        patient: "تحديث من الصيدلية",
        pharmacist: "إغلاق أو إجراء من الصيدلية",
      },
      pharmacien_ui: {
        patient: "تحديث من الصيدلية",
        pharmacist: "إغلاق أو إجراء من الصيدلية",
      },
      patient_abandon_request: {
        patient: "تخلّيت عن الطلب",
        pharmacist: "تخلي من طرف المريض",
      },
      counter_picked_up: {
        patient: "تم تسجيل الاستلام عند الصندوق",
        pharmacist: "تم تسجيل الاستلام عند الصندوق",
      },
      counter_unset: {
        patient: "أُعيد المنتج إلى انتظار الصندوق",
        pharmacist: "أعيدت متابعة الصندوق إلى الانتظار",
      },
      counter_cancelled_at_counter: {
        patient: "لم يُستلم عند الصندوق",
        pharmacist: "لم يُستلم عند الصندوق",
      },
      counter_other: {
        patient: "تحديث عند الصندوق",
        pharmacist: "تحديث الصندوق",
      },
      auditSingle: {
        patient: "تعديل بعد تأكيد المريض",
        pharmacist: "تعديل بعد تأكيد المريض",
      },
      auditMultiple: {
        patient: "تعديلات بعد تأكيد المريض",
        pharmacist: "تعديلات بعد تأكيد المريض",
      },
      fallback: {
        patient: "تم تسجيل تحديث",
        pharmacist: "تم تسجيل تحديث على الملف",
      },
    },
    statusChange: {
      submitted_to_in_review: {
        patient: "فتحت الصيدلية الملف",
        pharmacist: "استلام داخلي للملف",
      },
      in_review_to_responded: {
        patient: "ردّت الصيدلية: بانتظار تأكيدك",
        pharmacist: "تم نشر الرد للمريض",
      },
      responded_to_confirmed: {
        patient: "أكّدت العرض وموعد الزيارة",
        pharmacist: "أكّد المريض الاختيار",
      },
      responded_to_expired: {
        patient: "انتهت المهلة دون تأكيد منك",
        pharmacist: "انتهت المهلة لعدم تأكيد المريض",
      },
      responded_to_abandoned: {
        patient: "تخلّيت عن هذا الطلب",
        pharmacist: "تم تسجيل تخلي المريض بعد ردك",
      },
      confirmed_to_treated: {
        patient: "أنهت الصيدلية التحضير ويمكن المرور للصندوق",
        pharmacist: "تم إعلان الملف جاهزاً (الصندوق)",
      },
      treated_to_completed: {
        patient: "أُغلق الملف بعد الاستلام عند الصندوق",
        pharmacist: "أُغلق الملف بعد الصندوق",
      },
      treated_to_partially_collected: {
        patient: "تم تسجيل الإغلاق (استلام جزئي)",
        pharmacist: "أُغلق الملف بعد الصندوق",
      },
      treated_to_fully_collected: {
        patient: "تم تسجيل الإغلاق (استلام كامل)",
        pharmacist: "أُغلق الملف بعد الصندوق",
      },
      any_to_cancelled: {
        patient: "تم إلغاء الطلب",
        pharmacist: "تم إلغاء الطلب",
      },
      any_to_abandoned: {
        patient: "تم التخلي عن الطلب",
        pharmacist: "تم التخلي عن الطلب من طرف المريض",
      },
      any_to_expired: {
        patient: "انتهت صلاحية الطلب",
        pharmacist: "انتهت صلاحية الطلب من جهة المريض",
      },
      fallbackPatient: "تطور الملف",
      fallbackPharmacist: "انتقل الملف من",
      creationPatient: {
        submitted: "تم إرسال الطلب إلى الصيدلية",
        in_review: "الصيدلية تعالج طلبك",
      },
      creationPharmacist: {
        submitted: "تم استلام طلب جديد",
      },
    },
    historyPatient: {
      submitted: "تم إرسال الطلب إلى الصيدلية.",
      in_review: "الصيدلية تعالج طلبك.",
      submitted_to_in_review: "فتحت الصيدلية الملف.",
      in_review_to_responded: "ردّت الصيدلية: بانتظار تأكيدك.",
      responded_to_confirmed: "أكّدت العرض وموعد الزيارة.",
      responded_to_expired: "انتهت المهلة دون تأكيد منك.",
      responded_to_abandoned: "تخلّيت عن هذا الطلب.",
      confirmed_to_treated: "أنهت الصيدلية التحضير ويمكن المرور للصندوق.",
      confirmed_to_processing: "الصيدلية تتابع التحضير (مرحلة وسيطة).",
      processing_to_treated: "اكتمل التحضير من جهة الصيدلية.",
      treated_to_completed: "أُغلق الملف بعد الاستلام عند الصندوق.",
      treated_to_partially_collected: "تم تسجيل الإغلاق (استلام جزئي).",
      treated_to_fully_collected: "تم تسجيل الإغلاق (استلام كامل).",
      cancelled: "تم إلغاء الطلب.",
      abandoned: "تم التخلي عن الطلب.",
      expired: "انتهت صلاحية الطلب.",
      fallback: "تم تسجيل مرحلة",
      fallbackTransition: "تطور الملف",
    },
  },
  actors: {
    you: "أنت",
    patient: "المريض",
    pharmacy: "الصيدلية",
    system: "تلقائي",
    now: "اليوم",
    summary: "ملخص",
  },
  origin: {
    patientSent: "أرسلت طلبك",
    pharmacyReceived: "تم استلام الطلب",
    patientNoteAtSendPharmacist: "ملاحظة المريض عند الإرسال: « {note} »",
    patientNoteAtSendPatient: "رسالتك عند الإرسال: « {note} »",
  },
  dossierMeta: {
    closureArchivedTitlePharmacist: "ملف مؤرشف",
    closureArchivedTitlePatient: "نهاية طلبك",
    finalStatusPharmacist: "الحالة النهائية: {status}.",
    finalStatusPatient: "طلبك {status}.",
    currentTitlePharmacist: "الوضع الحالي للملف",
    currentTitlePatient: "أين وصل طلبك اليوم",
    currentStatusLabel: "الحالة الحالية: {status}.",
    awaitingValidationPharmacist: "بانتظار تأكيد المريض.",
    awaitingValidationPatient: "بانتظار تأكيدك.",
  },
  lineBody: {
    product: "المنتج: {name}",
    requestedQtyPrescription: "الكمية الموصوفة: {qty}",
    requestedQtyDefault: "الكمية المطلوبة: {qty}",
    proposedQtyPrescription: "الكمية الموصوفة: {qty}",
    proposedQtyDefault: "الكمية المقترحة: {qty}",
    patientNotePharmacist: "ملاحظة المريض: « {note} »",
    patientNotePatient: "ملاحظتك: « {note} »",
    pharmacistOriginPrescription: "وصفة طبية",
    pharmacistOriginProposed: "منتج مقترح من الصيدلية",
    pharmacistOriginLabel: "{origin}: {name}",
    motive: "السبب: {text}",
    availability: "التوفر: {status}",
    proposedQty: "الكمية المقترحة: {qty}",
    unitPrice: "السعر الوحدوي: {price} MAD",
    receptionPlanned: "استلام متوقع: {date}",
    alternativeOne: "بديل مقترح: {name}",
    alternativesMany: "بدائل مقترحة: {names}{suffix}",
    pharmacyNotePharmacist: "ملاحظة الصيدلية: « {note} »",
    pharmacyNotePatient: "رسالة: « {note} »",
    retainedProductAlternative: "منتج مُختار: {name} (بديل)",
    retainedProduct: "منتج مُختار: {name}",
    initiallyRequested: "مطلوب في الأصل: {name}",
    retainedQty: "كمية مُختارة: {qty}",
    validationSkippedProposedPharmacist: "هذا الاقتراح خارج الطلب المُؤكَّد.",
    validationSkippedProposedPatient: "هذا الاقتراح ليس جزءاً من طلبك.",
    validationSkippedProductPharmacist: "هذا المنتج خارج الطلب المُؤكَّد.",
    validationSkippedProductPatient: "هذا المنتج ليس جزءاً من طلبك.",
    amendmentRecorded: "تعديل مسجّل.",
    withdrawAutoClosurePharmacist: "سُحب تلقائياً عند الإغلاق (غير مُستَلَم).",
    withdrawAutoClosurePatient: "سُحب تلقائياً عند الإغلاق لعدم الاستلام.",
    withdrawActivePharmacist: "سُحب من الطلب النشط.",
    withdrawActivePatient: "سُحب من طلبك النشط.",
    epilogueNotAcceptedPharmacist: "اقتراح غير مقبول.",
    epilogueNotAcceptedPatient: "لم تقبله.",
    epilogueNotRetainedPharmacist: "غير مُختار عند التأكيد.",
    epilogueNotRetainedPatient: "لم تُختاره.",
    epiloguePickedUp: "مُستَلَم عند الصندوق.",
    epilogueExpiredPharmacist: "ملف منتهٍ.",
    epilogueExpiredPatient: "طلب منتهٍ.",
    epilogueCancelledPharmacist: "ملف ملغى أو مُهمَل.",
    epilogueCancelledPatient: "طلب ملغى أو مُهمَل.",
    epilogueClosedPharmacist: "ملف مُغلق.",
    epilogueClosedPatient: "طلب منتهٍ.",
    epilogueWithdrawnActivePharmacist: "مُسحوب — خارج الطلب النشط.",
    epilogueWithdrawnActivePatient: "مُسحوب من طلبك النشط.",
    preparation: "التحضير: {status}.",
    awaitingSupplier: "بانتظار استلام المورد.",
    awaitingVisitPharmacist: "بانتظار زيارة المريض.",
    awaitingVisitPatient: "بانتظار زيارتك.",
    receptionEta: "استلام متوقع: {date}.",
    trackedQty: "كمية متابَعة: {tracked} (مُؤكَّدة: {validated}).",
    counter: "الصندوق: {label}.",
    fulfillmentReserved: "محجوز في الصيدلية",
    fulfillmentOrdered: "طلب مورد قيد التنفيذ",
    fulfillmentArrived: "وصل للصيدلية، جاهز للاستلام",
    fulfillmentPending: "قيد التحديد",
  },
};
