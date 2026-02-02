import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, Database, CreditCard } from "lucide-react";

export default function Policies() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Legal Policies</h2>
          <p className="text-muted-foreground">Review our terms, privacy, and data protection policies</p>
        </div>
      </div>

      <Tabs defaultValue="privacy" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="privacy" data-testid="tab-privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="terms" data-testid="tab-terms">
            <FileText className="h-4 w-4 mr-2" />
            Terms
          </TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">
            <Database className="h-4 w-4 mr-2" />
            Data
          </TabsTrigger>
          <TabsTrigger value="debit" data-testid="tab-debit">
            <CreditCard className="h-4 w-4 mr-2" />
            Direct Debit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="text-lg font-semibold mb-3">1. Introduction</h3>
                    <p className="text-muted-foreground mb-2">
                      DropFlow ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our dropshipping automation platform.
                    </p>
                    <p className="text-muted-foreground">
                      By using DropFlow, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this Privacy Policy, please do not access the platform.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">2. Information We Collect</h3>
                    <p className="text-muted-foreground mb-2">We collect information that you provide directly to us, including:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Account registration information (name, email address)</li>
                      <li>Marketplace store credentials and API keys</li>
                      <li>Product inventory data and pricing information</li>
                      <li>Order and transaction details</li>
                      <li>Payment information (processed securely via Stripe)</li>
                      <li>Communication preferences and support inquiries</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">3. How We Use Your Information</h3>
                    <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Provide, maintain, and improve our platform</li>
                      <li>Process transactions and manage your wallet</li>
                      <li>Sync products and orders with your marketplace stores</li>
                      <li>Send transactional emails and service notifications</li>
                      <li>Provide customer support and respond to inquiries</li>
                      <li>Detect and prevent fraud or unauthorized access</li>
                      <li>Comply with legal obligations</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">4. Information Sharing</h3>
                    <p className="text-muted-foreground mb-2">
                      We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>With marketplace platforms to sync your store data (as authorized by you)</li>
                      <li>With payment processors (Stripe) to process transactions</li>
                      <li>With service providers who assist in operating our platform</li>
                      <li>If required by law or to protect our rights</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">5. Data Security</h3>
                    <p className="text-muted-foreground">
                      We implement industry-standard security measures to protect your data, including encryption of data in transit (TLS/SSL) and at rest. Your marketplace API credentials are encrypted and never stored in plain text. However, no method of transmission over the Internet is 100% secure.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">6. Data Retention</h3>
                    <p className="text-muted-foreground">
                      We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements. When you delete your account, we will delete or anonymize your data within 30 days, except where retention is required by law.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">7. Your Rights</h3>
                    <p className="text-muted-foreground mb-2">Depending on your location, you may have the right to:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Access the personal data we hold about you</li>
                      <li>Request correction of inaccurate data</li>
                      <li>Request deletion of your data</li>
                      <li>Object to processing of your data</li>
                      <li>Request data portability</li>
                      <li>Withdraw consent at any time</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">8. Cookies</h3>
                    <p className="text-muted-foreground">
                      We use essential cookies to maintain your session and preferences. We do not use tracking cookies for advertising purposes. You can configure your browser to refuse cookies, but this may limit platform functionality.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">9. Changes to This Policy</h3>
                    <p className="text-muted-foreground">
                      We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of the platform after changes constitutes acceptance of the updated policy.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">10. Contact Us</h3>
                    <p className="text-muted-foreground">
                      If you have questions about this Privacy Policy, please contact us at privacy@dropflow.com.
                    </p>
                  </section>

                  <p className="text-xs text-muted-foreground mt-8">Last Updated: February 2026</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle>User Agreement (Terms of Service)</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h3>
                    <p className="text-muted-foreground">
                      By creating an account and using DropFlow, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our platform. These terms constitute a legally binding agreement between you and DropFlow Ltd.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">2. Description of Service</h3>
                    <p className="text-muted-foreground">
                      DropFlow provides a software-as-a-service (SaaS) platform for automating dropshipping operations, including marketplace integration, inventory management, pricing automation, order processing, and wallet-based auto-fulfillment.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">3. Account Registration</h3>
                    <p className="text-muted-foreground mb-2">By registering, you agree that:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>You are at least 18 years old</li>
                      <li>You will provide accurate and complete registration information</li>
                      <li>You will verify your email address before accessing the dashboard</li>
                      <li>You are responsible for maintaining the confidentiality of your account</li>
                      <li>You are responsible for all activities that occur under your account</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">4. Subscription and Payments</h3>
                    <p className="text-muted-foreground mb-2">
                      Access to DropFlow features requires a paid subscription. By subscribing, you agree that:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Subscription fees are billed monthly in advance</li>
                      <li>Fees are non-refundable except as required by law</li>
                      <li>We may change prices with 30 days notice</li>
                      <li>Failure to pay may result in service suspension</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">5. Acceptable Use</h3>
                    <p className="text-muted-foreground mb-2">You agree NOT to:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Use the platform for illegal activities</li>
                      <li>Sell counterfeit, stolen, or prohibited products</li>
                      <li>Violate marketplace terms of service or VERO policies</li>
                      <li>Attempt to gain unauthorized access to systems</li>
                      <li>Interfere with platform operation or security</li>
                      <li>Share your account credentials with others</li>
                      <li>Resell or redistribute the platform without authorization</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">6. Marketplace Compliance</h3>
                    <p className="text-muted-foreground">
                      You are solely responsible for complying with the terms of service of any marketplace you connect to DropFlow. We provide VERO compliance detection as a tool, but this does not guarantee compliance. You accept full responsibility for the products you list and sell.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">7. Intellectual Property</h3>
                    <p className="text-muted-foreground">
                      DropFlow and its original content, features, and functionality are owned by DropFlow Ltd and are protected by international copyright, trademark, and other intellectual property laws. Your product data remains your property.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">8. Limitation of Liability</h3>
                    <p className="text-muted-foreground">
                      To the maximum extent permitted by law, DropFlow shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">9. Indemnification</h3>
                    <p className="text-muted-foreground">
                      You agree to indemnify and hold harmless DropFlow and its officers, directors, and employees from any claims, damages, or expenses arising from your use of the platform, violation of these terms, or infringement of any third-party rights.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">10. Termination</h3>
                    <p className="text-muted-foreground">
                      We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties. You may cancel your subscription at any time from your account settings.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">11. Governing Law</h3>
                    <p className="text-muted-foreground">
                      These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to conflict of law provisions. Any disputes shall be resolved in the courts of England and Wales.
                    </p>
                  </section>

                  <p className="text-xs text-muted-foreground mt-8">Last Updated: February 2026</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data Protection Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="text-lg font-semibold mb-3">1. Our Commitment</h3>
                    <p className="text-muted-foreground">
                      DropFlow is committed to protecting the personal data of our users in compliance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. This policy outlines how we process and protect your personal data.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">2. Data Controller</h3>
                    <p className="text-muted-foreground">
                      DropFlow Ltd is the data controller responsible for your personal data. If you have questions about how we handle your data, contact our Data Protection Officer at dpo@dropflow.com.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">3. Lawful Basis for Processing</h3>
                    <p className="text-muted-foreground mb-2">We process your personal data based on:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li><strong>Contract:</strong> Processing necessary to fulfill our service agreement</li>
                      <li><strong>Consent:</strong> Where you have given explicit consent (e.g., marketing)</li>
                      <li><strong>Legal Obligation:</strong> Where required by law</li>
                      <li><strong>Legitimate Interest:</strong> For fraud prevention and platform security</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">4. Data Processing Activities</h3>
                    <p className="text-muted-foreground mb-2">We process data for the following purposes:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Account creation and authentication</li>
                      <li>Marketplace store synchronization</li>
                      <li>Order processing and fulfillment</li>
                      <li>Payment processing</li>
                      <li>Customer support</li>
                      <li>Platform improvement and analytics</li>
                      <li>Legal compliance</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">5. Data Security Measures</h3>
                    <p className="text-muted-foreground mb-2">We implement appropriate technical and organizational measures:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Encryption of data in transit using TLS 1.3</li>
                      <li>Encryption of data at rest using AES-256</li>
                      <li>Regular security assessments and penetration testing</li>
                      <li>Access controls and audit logging</li>
                      <li>Employee training on data protection</li>
                      <li>Incident response procedures</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">6. International Data Transfers</h3>
                    <p className="text-muted-foreground">
                      Your data may be transferred to and processed in countries outside the UK/EEA. Where this occurs, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses approved by the UK ICO or adequacy decisions.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">7. Third-Party Processors</h3>
                    <p className="text-muted-foreground mb-2">We use the following categories of processors:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Cloud hosting providers (data storage)</li>
                      <li>Payment processors (Stripe)</li>
                      <li>Email service providers (transactional emails)</li>
                      <li>Analytics providers (platform improvement)</li>
                    </ul>
                    <p className="text-muted-foreground mt-2">
                      All processors are bound by data processing agreements ensuring GDPR compliance.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">8. Your Data Rights</h3>
                    <p className="text-muted-foreground mb-2">Under UK GDPR, you have the right to:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li><strong>Access:</strong> Request copies of your personal data</li>
                      <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
                      <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                      <li><strong>Restrict Processing:</strong> Request limited processing of your data</li>
                      <li><strong>Data Portability:</strong> Request transfer of your data</li>
                      <li><strong>Object:</strong> Object to processing based on legitimate interest</li>
                      <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
                    </ul>
                    <p className="text-muted-foreground mt-2">
                      To exercise these rights, contact dpo@dropflow.com. We will respond within 30 days.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">9. Data Breach Notification</h3>
                    <p className="text-muted-foreground">
                      In the event of a personal data breach that poses a risk to your rights and freedoms, we will notify the relevant supervisory authority within 72 hours and will inform you without undue delay if there is a high risk to your rights.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">10. Complaints</h3>
                    <p className="text-muted-foreground">
                      If you believe your data protection rights have been violated, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at ico.org.uk or by calling 0303 123 1113.
                    </p>
                  </section>

                  <p className="text-xs text-muted-foreground mt-8">Last Updated: February 2026</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debit">
          <Card>
            <CardHeader>
              <CardTitle>Direct Debit Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="text-lg font-semibold mb-3">1. Introduction</h3>
                    <p className="text-muted-foreground">
                      This Direct Debit Policy explains how recurring payments work for your DropFlow subscription and wallet top-ups. We use Stripe as our payment processor to ensure secure, reliable payment handling.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">2. Payment Authorization</h3>
                    <p className="text-muted-foreground mb-2">By providing your payment details and subscribing, you authorize DropFlow to:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Charge your payment method for monthly subscription fees</li>
                      <li>Charge your payment method for wallet top-ups you initiate</li>
                      <li>Retry failed payments up to 3 times over 7 days</li>
                      <li>Store your payment information securely with Stripe</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">3. Subscription Billing</h3>
                    <p className="text-muted-foreground mb-2">Your subscription works as follows:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Billing occurs on the same date each month (your "billing date")</li>
                      <li>If your billing date doesn't exist in a month, you're billed on the last day</li>
                      <li>Payments are in British Pounds (GBP)</li>
                      <li>You will receive email receipts for all payments</li>
                      <li>Failed payments may result in service suspension</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">4. Wallet Top-Ups</h3>
                    <p className="text-muted-foreground">
                      Wallet top-ups are one-time charges initiated by you. When you add funds to your wallet for auto-fulfillment, your payment method will be charged immediately. These are not recurring payments unless you specifically enable auto-top-up (if available).
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">5. Payment Security</h3>
                    <p className="text-muted-foreground mb-2">We prioritize the security of your payment information:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>All payments are processed through Stripe, a PCI-DSS Level 1 certified provider</li>
                      <li>DropFlow never stores your full card number</li>
                      <li>Strong Customer Authentication (SCA) is used where required</li>
                      <li>Encrypted communication protects all transactions</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">6. Changing Payment Method</h3>
                    <p className="text-muted-foreground">
                      You can update your payment method at any time from your Subscription page. The new payment method will be used for future charges. Ensure your payment details are up to date to avoid service interruption.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">7. Failed Payments</h3>
                    <p className="text-muted-foreground mb-2">If a payment fails:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>We will notify you by email immediately</li>
                      <li>Automatic retry attempts occur over 7 days</li>
                      <li>Your account remains active during the retry period</li>
                      <li>After 3 failed attempts, your subscription may be suspended</li>
                      <li>Update your payment method to restore service</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">8. Refunds</h3>
                    <p className="text-muted-foreground">
                      Subscription fees are generally non-refundable. However, if you believe you have been charged in error, please contact support@dropflow.com within 14 days of the charge. Refund requests are evaluated on a case-by-case basis.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">9. Cancellation</h3>
                    <p className="text-muted-foreground mb-2">You may cancel your subscription at any time:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Go to Subscription page and click "Cancel Subscription"</li>
                      <li>Your subscription remains active until the end of the billing period</li>
                      <li>No further charges will be made after cancellation</li>
                      <li>Wallet balance is not automatically refunded upon cancellation</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">10. Price Changes</h3>
                    <p className="text-muted-foreground">
                      We may change subscription prices with at least 30 days notice. You will be notified by email before any price change takes effect. Continuing your subscription after the notice period constitutes acceptance of the new price.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">11. Disputes</h3>
                    <p className="text-muted-foreground">
                      If you have a dispute about a charge, please contact us at billing@dropflow.com before disputing with your bank. Chargebacks without prior contact may result in account suspension. We're committed to resolving billing issues promptly.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold mb-3">12. Contact</h3>
                    <p className="text-muted-foreground">
                      For billing inquiries, contact billing@dropflow.com. For subscription changes, visit your Subscription page in the dashboard.
                    </p>
                  </section>

                  <p className="text-xs text-muted-foreground mt-8">Last Updated: February 2026</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
