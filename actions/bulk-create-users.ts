
'use server';

import { createUser } from './create-user';

type UserImportData = {
    fullName: string;
    email: string;
    password?: string;
    role: 'student' | 'mentor';
    initialBalance: number;
    lossLimitPercentage: number;
    dailyLossLimitPercentage: number;
    perTradeLossLimitPercentage: number;
    equityLeverage: number;
};

type BulkCreateResult = {
    success: boolean;
    message: string;
    results: {
        email: string;
        success: boolean;
        message: string;
    }[];
};

export async function bulkCreateUsers(users: UserImportData[]): Promise<BulkCreateResult> {
    
    if (!users || users.length === 0) {
        return { success: false, message: 'No user data provided.', results: [] };
    }

    const creationResults = [];
    let successCount = 0;

    for (const user of users) {
        try {
            // Re-use the existing, stable `createUser` server action
            const result = await createUser({
                fullName: user.fullName,
                email: user.email,
                password: user.password,
                role: user.role,
                initialBalance: user.initialBalance,
                lossLimitPercentage: user.lossLimitPercentage,
                dailyLossLimitPercentage: user.dailyLossLimitPercentage,
                perTradeLossLimitPercentage: user.perTradeLossLimitPercentage,
                equityLeverage: user.equityLeverage,
            });

            creationResults.push({
                email: user.email,
                success: result.success,
                message: result.message,
            });

            if (result.success) {
                successCount++;
            }

        } catch (error: any) {
            creationResults.push({
                email: user.email,
                success: false,
                message: error.message || 'An unknown error occurred.',
            });
        }
    }

    const totalCount = users.length;
    return {
        success: true,
        message: `Processed ${totalCount} users. ${successCount} created successfully, ${totalCount - successCount} failed.`,
        results: creationResults,
    };
}
