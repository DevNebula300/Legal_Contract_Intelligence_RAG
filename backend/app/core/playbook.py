PLAYBOOK = {
    "Limitation of Liability": {
        "required": True,
        "risk_if_missing": "high",
        "rules": [
            {
                "condition": "uncapped",
                "keywords": ["unlimited liability", "no limitation", "no cap"],
                "risk_level": "high",
                "rationale": "Uncapped liability exposes the party to unlimited financial risk."
            },
            {
                "condition": "capped_low",
                "keywords": ["liability shall not exceed", "aggregate liability"],
                "risk_level": "medium",
                "rationale": "Liability cap present; verify the cap amount is reasonable relative to contract value."
            }
        ]
    },
    "Termination": {
        "required": True,
        "risk_if_missing": "medium",
        "rules": [
            {
                "condition": "no_termination_for_convenience",
                "keywords": ["for cause only", "material breach"],
                "risk_level": "medium",
                "rationale": "No termination-for-convenience clause; party may be locked into the contract absent breach."
            }
        ]
    },
    "Indemnification": {
        "required": True,
        "risk_if_missing": "high",
        "rules": [
            {
                "condition": "one_sided",
                "keywords": ["indemnify and hold harmless"],
                "risk_level": "medium",
                "rationale": "Check whether indemnification obligations are mutual or one-sided."
            }
        ]
    },
    "Confidentiality": {
        "required": True,
        "risk_if_missing": "medium",
        "rules": []
    },
    "Governing Law": {
        "required": True,
        "risk_if_missing": "low",
        "rules": []
    },
    "Data Protection": {
        "required": False,
        "risk_if_missing": "medium",
        "rules": []
    },
    "Renewal": {
        "required": False,
        "risk_if_missing": "low",
        "rules": [
            {
                "condition": "auto_renewal",
                "keywords": ["automatically renew", "auto-renew"],
                "risk_level": "medium",
                "rationale": "Auto-renewal clause present; confirm notice period for opting out."
            }
        ]
    },
}