'use client'

import React from 'react'

const PrivacyPolicyPage = () => {
    return (
        <main className="max-w-3xl mx-auto px-4 py-10 leading-relaxed">
            <h1 className="text-3xl font-bold mb-8 text-center">Privacy Policy</h1>

            {/* 1. Introduction */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="mb-3">
                    Welcome to <span className="font-bold text-primary">CarCar</span>. We respect your privacy and are committed to protecting the personal data of our users.
                </p>
                <p className="mb-3">
                    <span className="font-bold text-primary">CarCar</span> is a platform that collects listings from publicly available websites, stores them in a database, and provides users with access to this information.
                </p>
                <p>
                    If you have any questions regarding our privacy policy or the processing of your data, you can contact us via email: <a href="mailto:nookon@icloud.com" className="text-primary underline">nookon@icloud.com</a>.
                </p>
            </section>

            {/* 2. Information We Collect */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                <p className="mb-3">
                    We only collect information that users provide through Telegram. This includes:
                </p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                    <li>First and last name</li>
                    <li>Username</li>
                    <li>Profile picture</li>
                    <li>Location (for filtering listings)</li>
                    <li>Language preference</li>
                </ul>
                <p>We do not collect any other personal data beyond what is shared via Telegram.</p>
            </section>

            {/* 3. How We Use and Share Your Information */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">3. How We Use and Share Your Information</h2>
                <p className="mb-3">
                    We use the information collected from users <strong>only to filter and display listings</strong> relevant to each user on our platform.
                </p>
                <p className="mb-3">
                    Additionally, we may use third-party services, such as <strong>Google AdSense</strong>, to display advertisements on our platform. These services may collect information about users’ interactions with ads to provide personalized advertising.
                </p>
                <p>
                    We do <strong>not</strong> sell or share your personal data with third parties for any other purposes.
                </p>
            </section>

            {/* 4. Data Storage and Security */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">4. Data Storage and Security</h2>
                <p>
                    User data is stored on <strong>Amazon servers</strong> with full protection and encryption. We take all necessary measures to safeguard your personal information against unauthorized access, alteration, disclosure, or destruction.
                </p>
            </section>

            {/* 5. User Rights */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">5. User Rights</h2>
                <p>
                    Users have the right to <strong>request the deletion of all their personal data</strong> at any time. Additionally, users can <strong>update or modify their information</strong> whenever they wish.
                </p>
            </section>

            {/* 6. Cookies and Trackers */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">6. Cookies and Trackers</h2>
                <p>
                    Currently, we do <strong>not</strong> use cookies or other tracking technologies on our platform, except for third-party services like Google AdSense for displaying advertisements.
                </p>
            </section>

            {/* 7. International Data Transfer */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">7. International Data Transfer</h2>
                <p>
                    Although our users are located in Poland, their data is stored on servers distributed across Europe. We ensure that all transfers comply with applicable data protection laws and maintain appropriate security measures.
                </p>
            </section>

            {/* 8. Changes to This Privacy Policy */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4">8. Changes to This Privacy Policy</h2>
                <p>
                    We may update this Privacy Policy from time to time. <strong>All users will be notified</strong> of any changes. We encourage you to review this policy periodically to stay informed about how we protect your information.
                </p>
            </section>
        </main>
    )
}

export default PrivacyPolicyPage
