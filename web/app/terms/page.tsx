import Link from "next/link";
import NavBar from "@/app/components/NavBar";

export const metadata = {
  title: "Terms of Service — Verafile Sentinel",
};

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-lg font-semibold text-white">
        {number}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-[#E2E8F0]">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A1628]">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-serif text-3xl font-semibold text-white">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Last updated: June 12, 2026
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[#E2E8F0]">
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of Verafile Sentinel (the &quot;Service&quot;), operated by OCP
          Labs / Creation Enterprises Group INC (&quot;we,&quot;
          &quot;us,&quot; or &quot;our&quot;). By creating an account or using
          the Service, you agree to be bound by these Terms. If you do not
          agree, do not use the Service.
        </p>

        <Section number={1} title="Service Description">
          <p>
            Verafile Sentinel provides blockchain-anchored file integrity
            documentation. The Service computes cryptographic fingerprints
            (hashes) of files you select and commits those fingerprints to a
            public blockchain, producing verifiable proof that the files
            existed in a specific state at a specific point in time.
          </p>
          <p>
            The Service is an evidence-documentation tool only. It is{" "}
            <strong>not</strong> a CMMC certification service, it is{" "}
            <strong>not</strong> a CMMC Third-Party Assessment Organization
            (C3PAO), and it does not perform, replace, or substitute for CMMC
            assessments, gap analyses, audits, or any other compliance
            evaluation.
          </p>
        </Section>

        <Section number={2} title="No Compliance Guarantee">
          <p>
            Use of Verafile Sentinel does not guarantee CMMC certification,
            assessment success, or compliance with any law, regulation,
            framework, or contractual requirement. Compliance determinations
            under the CMMC program are made exclusively by authorized C3PAO
            assessors and applicable government authorities.
          </p>
          <p>
            The Service provides evidence artifacts only. Whether such
            artifacts are accepted, sufficient, or relevant in any assessment,
            audit, dispute, or proceeding is determined solely by the
            applicable assessor, auditor, court, or authority, and we make no
            representation or warranty regarding such acceptance.
          </p>
        </Section>

        <Section number={3} title="Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, VERAFILE SENTINEL AND OCP
            LABS / CREATION ENTERPRISES GROUP INC, AND THEIR OFFICERS,
            DIRECTORS, EMPLOYEES, AND AGENTS, SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
            PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA,
            CONTRACTS, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATING TO
            YOUR USE OF OR INABILITY TO USE THE SERVICE, INCLUDING WITHOUT
            LIMITATION DAMAGES ARISING FROM FAILED CMMC ASSESSMENTS, LOST OR
            UNAWARDED CONTRACTS, OR BUSINESS INTERRUPTION, WHETHER BASED IN
            CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, EVEN
            IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p>
            IN ALL CASES, OUR AGGREGATE LIABILITY ARISING OUT OF OR RELATING
            TO THE SERVICE SHALL NOT EXCEED THE TOTAL FEES YOU PAID TO US FOR
            THE SERVICE IN THE THIRTY (30) DAYS IMMEDIATELY PRECEDING THE
            EVENT GIVING RISE TO THE CLAIM.
          </p>
          <p>
            Some jurisdictions do not allow the exclusion or limitation of
            certain damages; in such jurisdictions, our liability is limited
            to the maximum extent permitted by law.
          </p>
        </Section>

        <Section number={4} title="Blockchain Dependency">
          <p>
            Proofs produced by the Service depend on the continued public
            availability of Arbitrum One blockchain data. While public
            blockchain data is highly durable and replicated across many
            independent operators, we do not control the Arbitrum One network
            and make no guarantee of its perpetual availability, performance,
            or accessibility.
          </p>
          <p>
            You are responsible for retaining your proof JSON files and the
            original anchored documents in your own storage. Independent
            verification of a proof requires both the proof file and the
            original document; the Service does not retain copies of your
            files (see Section 7).
          </p>
        </Section>

        <Section number={5} title="Acceptable Use">
          <p>
            You may not use the Service to anchor false, fraudulent,
            backdated, forged, or otherwise misleading documents, or to create
            evidence intended to deceive any assessor, auditor, court,
            government authority, or other party. You are solely responsible
            for the accuracy, authenticity, and lawfulness of every document
            you anchor.
          </p>
          <p>
            You may not attempt to circumvent usage limits, interfere with the
            operation of the Service, access accounts or data belonging to
            others, or use the Service in violation of applicable law,
            including export control and government contracting regulations.
            We may suspend or terminate accounts that violate this section.
          </p>
        </Section>

        <Section number={6} title="Payment and Cancellation">
          <p>
            Paid subscriptions are billed monthly in advance through our
            payment processor, Stripe. You may cancel your subscription at any
            time; cancellation takes effect at the end of the current billing
            period. We do not provide refunds or credits for partial months.
          </p>
          <p>
            Proofs anchored before cancellation remain valid and independently
            verifiable after cancellation, because they exist on the public
            blockchain and in the proof files you have retained. Demo accounts
            include a fixed lifetime allowance of five (5) anchors at no
            charge.
          </p>
        </Section>

        <Section number={7} title="Data and Privacy">
          <p>
            File contents are never transmitted to our servers. Cryptographic
            fingerprints are computed locally in your browser, and only those
            fingerprints — not your files — are processed and anchored.
          </p>
          <p>
            We store your account information (name, email, hashed password,
            subscription status) and anchor metadata (transaction hashes,
            document types, organization names you provide, file counts, and
            timestamps). We do not sell user data. Payment card details are
            handled by Stripe and are never stored on our systems.
          </p>
        </Section>

        <Section number={8} title="Governing Law">
          <p>
            These Terms are governed by the laws of the State of California,
            without regard to its conflict-of-laws principles. Any dispute
            arising out of or relating to these Terms or the Service shall be
            resolved exclusively in the state or federal courts located in Los
            Angeles County, California, and you consent to the personal
            jurisdiction of those courts.
          </p>
        </Section>

        <Section number={9} title="Contact">
          <p>
            OCP Labs / Creation Enterprises Group INC
            <br />
            425 N. Lomita St, Burbank, CA 91506
            <br />
            <a
              href="mailto:damon@ocp-labs.org"
              className="text-[#86EFAC] hover:underline"
            >
              damon@ocp-labs.org
            </a>
          </p>
        </Section>

        <p className="mt-10 border-t border-[#1A3A6B] pt-6 text-xs text-[#6B7280]">
          We may update these Terms from time to time. Material changes will
          be posted on this page with an updated date. Continued use of the
          Service after changes take effect constitutes acceptance of the
          revised Terms.
        </p>

        <p className="mt-4 text-xs text-[#6B7280]">
          <Link href="/register" className="text-[#86EFAC] hover:underline">
            Create an account
          </Link>{" "}
          ·{" "}
          <Link href="/pricing" className="text-[#86EFAC] hover:underline">
            Pricing
          </Link>
        </p>
      </main>
    </div>
  );
}
