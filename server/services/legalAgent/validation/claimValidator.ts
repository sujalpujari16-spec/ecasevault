/**
 * e-CASEVAULT Claim Validator
 * Phase 18: Grounding Verification for Individual Legal Assertions
 */

import { ProvisionService, LegalProvision } from '../legal/provisionService';

export interface ClaimItem {
  text: string;
  sourceIds: string[];
}

export interface ValidatedClaim {
  text: string;
  sourceIds: string[];
  isGrounded: boolean;
  unsupportedReason?: string;
}

export class ClaimValidator {
  private static instance: ClaimValidator;
  private provisionService = ProvisionService.getInstance();

  public static getInstance(): ClaimValidator {
    if (!ClaimValidator.instance) {
      ClaimValidator.instance = new ClaimValidator();
    }
    return ClaimValidator.instance;
  }

  public validateClaims(
    claims: ClaimItem[],
    availableProvisions: LegalProvision[]
  ): { validatedClaims: ValidatedClaim[]; ungroundedCount: number } {
    let ungroundedCount = 0;
    const validatedClaims: ValidatedClaim[] = [];

    const provMap = new Map<string, LegalProvision>();
    for (const p of availableProvisions) {
      provMap.set(`${p.actCode}_${p.sectionNumber}`.toUpperCase(), p);
      provMap.set(`${p.actCode} Section ${p.sectionNumber}`.toUpperCase(), p);
      provMap.set(p.id.toUpperCase(), p);
    }

    for (const claim of claims) {
      let isGrounded = false;
      let reason: string | undefined;

      if (!claim.sourceIds || claim.sourceIds.length === 0) {
        isGrounded = false;
        reason = 'No statutory source provided for assertion.';
      } else {
        // Check if at least one source matches and supports keywords in claim
        for (const src of claim.sourceIds) {
          const prov = provMap.get(src.toUpperCase()) || this.provisionService.getById(src);
          if (prov) {
            // Check semantic/token overlap between claim and statutory provision text
            const claimWords = claim.text
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .split(/\s+/)
              .filter((w) => w.length > 4);

            const provText = `${prov.sectionTitle} ${prov.cleanText}`.toLowerCase();
            const overlap = claimWords.filter((w) => provText.includes(w)).length;
            if (claimWords.length === 0 || overlap / claimWords.length >= 0.3) {
              isGrounded = true;
              break;
            }
          }
        }

        if (!isGrounded) {
          reason = 'Claim statements could not be verified against cited statutory provision text.';
        }
      }

      if (!isGrounded) ungroundedCount++;

      validatedClaims.push({
        text: claim.text,
        sourceIds: claim.sourceIds,
        isGrounded,
        unsupportedReason: reason,
      });
    }

    return {
      validatedClaims,
      ungroundedCount,
    };
  }
}
