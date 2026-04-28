using System.Collections.Immutable;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Diagnostics;

namespace BackendShared.Analyzers;

/// <summary>
/// Bans the null-forgiving operator <c>!</c> (postfix) in backend service code.
/// The <c>!</c> operator silently suppresses nullable-reference warnings without
/// fixing the underlying type or adding a real null guard — it is the C# analogue
/// of the TypeScript <c>as T</c> / non-null assertion escape hatch.
/// <para/>
/// Diagnostic ID: <c>BSH0001</c>. Wired as error in
/// <c>.editorconfig</c> for the strict path glob
/// <c>{BackendShared,MessageRelay,VoiceBridge,ContentService}/**.cs</c>.
/// </summary>
[DiagnosticAnalyzer(LanguageNames.CSharp)]
public sealed class NullForgivingBanAnalyzer : DiagnosticAnalyzer
{
    /// <summary>Diagnostic ID registered in <c>.editorconfig</c>.</summary>
    public const string DiagnosticId = "BSH0001";

    private static readonly DiagnosticDescriptor Rule = new(
        id: DiagnosticId,
        title: "Null-forgiving operator '!' is banned",
        messageFormat: "The null-forgiving operator '!' silently suppresses null-safety. Fix the type, use pattern matching ('is T t'), or add an explicit null guard instead.",
        category: "NullSafety",
        defaultSeverity: DiagnosticSeverity.Error,
        isEnabledByDefault: true,
        description: "Using '!' on an expression suppresses a nullable warning without resolving the underlying null-safety concern. " +
                     "Prefer: 'if (x is SomeType t)' pattern matching, conditional access '?.', or a null-coalescing guard '?? throw'.");

    /// <inheritdoc/>
    public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics =>
        ImmutableArray.Create(Rule);

    /// <inheritdoc/>
    public override void Initialize(AnalysisContext context)
    {
        context.ConfigureGeneratedCodeAnalysis(GeneratedCodeAnalysisFlags.None);
        context.EnableConcurrentExecution();
        context.RegisterSyntaxNodeAction(
            AnalyzeNode,
            SyntaxKind.SuppressNullableWarningExpression);
    }

    private static void AnalyzeNode(SyntaxNodeAnalysisContext context) =>
        context.ReportDiagnostic(Diagnostic.Create(Rule, context.Node.GetLocation()));
}
