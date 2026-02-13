# =============================================================================
# Dataverse Web API Helper for MCS Agent Automation
# =============================================================================
# Provides token acquisition and all CRUD + bound action patterns for managing
# Copilot Studio agents via Dataverse Web API.
#
# Token methods (in priority order):
#   1. Az PowerShell (Get-AzAccessToken) — interactive, best for dev
#   2. Service Principal (OAuth2 client_credentials) — unattended/CI
#
# Usage:
#   . .\tools\dataverse-helper.ps1
#   $ctx = Connect-Dataverse -OrgUrl "https://orgXXX.crm.dynamics.com"
#   $bots = Get-Bots -Ctx $ctx
#   Update-BotInstructions -Ctx $ctx -BotId "<guid>" -Instructions "New instructions"
# =============================================================================

param(
    [string]$OrgUrl,
    [string]$ClientId,
    [string]$ClientSecret,
    [string]$TenantId
)

# -----------------------------------------------------------------------------
# Token Acquisition
# -----------------------------------------------------------------------------

function Connect-Dataverse {
    <#
    .SYNOPSIS
        Establishes a Dataverse connection and returns a context object with headers.
    .PARAMETER OrgUrl
        The Dataverse organization URL (e.g., https://orgXXX.crm.dynamics.com)
    .PARAMETER ClientId
        (Optional) App registration client ID for service principal auth
    .PARAMETER ClientSecret
        (Optional) App registration client secret for service principal auth
    .PARAMETER TenantId
        (Optional) Entra ID tenant ID for service principal auth
    #>
    param(
        [Parameter(Mandatory)][string]$OrgUrl,
        [string]$ClientId,
        [string]$ClientSecret,
        [string]$TenantId
    )

    $OrgUrl = $OrgUrl.TrimEnd('/')
    $token = $null

    if ($ClientId -and $ClientSecret -and $TenantId) {
        # Service Principal auth (unattended)
        Write-Host "Authenticating via service principal..." -ForegroundColor Cyan
        $tokenEndpoint = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"
        $authBody = @{
            client_id     = $ClientId
            client_secret = $ClientSecret
            scope         = "$OrgUrl/.default"
            grant_type    = 'client_credentials'
        }
        $authResponse = Invoke-RestMethod -Uri $tokenEndpoint -Method POST `
            -ContentType 'application/x-www-form-urlencoded' -Body $authBody
        $token = $authResponse.access_token
    }
    else {
        # Az PowerShell interactive auth
        Write-Host "Authenticating via Az PowerShell..." -ForegroundColor Cyan
        if (-not (Get-Module -ListAvailable Az.Accounts)) {
            throw "Az.Accounts module not installed. Run: Install-Module Az.Accounts -Scope CurrentUser"
        }
        Import-Module Az.Accounts -ErrorAction Stop
        if ($null -eq (Get-AzContext)) {
            Connect-AzAccount | Out-Null
        }
        $secureToken = (Get-AzAccessToken -ResourceUrl $OrgUrl -AsSecureString).Token
        $token = ConvertFrom-SecureString -SecureString $secureToken -AsPlainText
    }

    if (-not $token) {
        throw "Failed to acquire token"
    }

    $headers = @{
        'Authorization'    = "Bearer $token"
        'Accept'           = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }

    # Verify connectivity
    $whoAmI = Invoke-RestMethod -Uri "$OrgUrl/api/data/v9.2/WhoAmI" -Method GET -Headers $headers
    Write-Host "Connected as: $($whoAmI.UserId) | Org: $($whoAmI.OrganizationId)" -ForegroundColor Green

    return @{
        OrgUrl  = $OrgUrl
        Headers = $headers
        UserId  = $whoAmI.UserId
        OrgId   = $whoAmI.OrganizationId
    }
}

# -----------------------------------------------------------------------------
# Query Operations
# -----------------------------------------------------------------------------

function Get-Bots {
    <#
    .SYNOPSIS
        List all agents in the environment.
    #>
    param([Parameter(Mandatory)][hashtable]$Ctx)

    $uri = "$($Ctx.OrgUrl)/api/data/v9.2/bots?" +
        "`$select=botid,name,schemaname,statecode,publishedon,accesscontrolpolicy,authenticationmode" +
        "&`$orderby=name"
    $result = Invoke-RestMethod -Uri $uri -Method GET -Headers $Ctx.Headers
    return $result.value
}

function Get-BotByName {
    <#
    .SYNOPSIS
        Find an agent by display name.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$Name
    )

    $uri = "$($Ctx.OrgUrl)/api/data/v9.2/bots?" +
        "`$filter=name eq '$Name'" +
        "&`$select=botid,name,schemaname,statecode,publishedon"
    $result = Invoke-RestMethod -Uri $uri -Method GET -Headers $Ctx.Headers
    return $result.value
}

function Get-BotComponents {
    <#
    .SYNOPSIS
        Get bot components by type.
    .PARAMETER ComponentType
        0=Topic, 5=Trigger, 9=TopicV2, 14=FileAttachment, 15=CustomGPT(instructions),
        16=KnowledgeSource, 17=ExternalTrigger, 18=CopilotSettings, 19=TestCase
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId,
        [int]$ComponentType = -1
    )

    $filter = "_parentbotid_value eq '$BotId'"
    if ($ComponentType -ge 0) {
        $filter += " and componenttype eq $ComponentType"
    }
    $uri = "$($Ctx.OrgUrl)/api/data/v9.2/botcomponents?" +
        "`$filter=$filter" +
        "&`$select=botcomponentid,name,componenttype,content"
    $result = Invoke-RestMethod -Uri $uri -Method GET -Headers $Ctx.Headers
    return $result.value
}

# -----------------------------------------------------------------------------
# Update Operations
# -----------------------------------------------------------------------------

function Update-BotInstructions {
    <#
    .SYNOPSIS
        Update an agent's instructions (componenttype 15 = Custom GPT).
    .PARAMETER Instructions
        The new instructions text to set.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId,
        [Parameter(Mandatory)][string]$Instructions
    )

    # Find the Custom GPT component
    $components = Get-BotComponents -Ctx $Ctx -BotId $BotId -ComponentType 15
    if ($components.Count -eq 0) {
        throw "No instructions component (type 15) found for bot $BotId"
    }

    $component = $components[0]
    $componentId = $component.botcomponentid
    $existingContent = $component.content

    # Parse the content (JSON or YAML structure)
    try {
        $contentObj = $existingContent | ConvertFrom-Json
        # Update the systemMessage/instructions field
        if ($contentObj.PSObject.Properties['systemMessage']) {
            $contentObj.systemMessage = $Instructions
        }
        elseif ($contentObj.PSObject.Properties['instructions']) {
            $contentObj.instructions = $Instructions
        }
        else {
            # Add systemMessage if no known field exists
            $contentObj | Add-Member -NotePropertyName 'systemMessage' -NotePropertyValue $Instructions -Force
        }
        $updatedContent = $contentObj | ConvertTo-Json -Depth 20 -Compress
    }
    catch {
        # If content is not JSON (could be plain text or YAML), replace directly
        Write-Warning "Content is not JSON. Setting instructions as raw content."
        $updatedContent = $Instructions
    }

    # PATCH back
    $body = @{ content = $updatedContent } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "$($Ctx.OrgUrl)/api/data/v9.2/botcomponents($componentId)" `
        -Method PATCH -Body $body -Headers $Ctx.Headers -ContentType "application/json"

    # Verify
    $verify = Invoke-RestMethod -Uri "$($Ctx.OrgUrl)/api/data/v9.2/botcomponents($componentId)?`$select=content" `
        -Method GET -Headers $Ctx.Headers
    Write-Host "Instructions updated. Content length: $($verify.content.Length)" -ForegroundColor Green

    return $componentId
}

function Update-BotSecurity {
    <#
    .SYNOPSIS
        Update bot security/auth settings.
    .PARAMETER AccessControl
        0=Any, 1=Copilot readers, 2=Group membership
    .PARAMETER AuthMode
        0=Unspecified, 1=None, 2=Integrated, 3=Custom AAD
    .PARAMETER AuthTrigger
        0=As Needed, 1=Always
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId,
        [int]$AccessControl = 0,
        [int]$AuthMode = 2,
        [int]$AuthTrigger = 0
    )

    $body = @{
        accesscontrolpolicy  = $AccessControl
        authenticationmode   = $AuthMode
        authenticationtrigger = $AuthTrigger
    } | ConvertTo-Json

    Invoke-RestMethod -Uri "$($Ctx.OrgUrl)/api/data/v9.2/bots($BotId)" `
        -Method PATCH -Body $body -Headers $Ctx.Headers -ContentType "application/json"

    # Verify
    $bot = Invoke-RestMethod -Uri "$($Ctx.OrgUrl)/api/data/v9.2/bots($BotId)?`$select=accesscontrolpolicy,authenticationmode,authenticationtrigger" `
        -Method GET -Headers $Ctx.Headers
    Write-Host "Security updated. Access=$($bot.accesscontrolpolicy) Auth=$($bot.authenticationmode) Trigger=$($bot.authenticationtrigger)" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# Knowledge Operations
# -----------------------------------------------------------------------------

function Add-BotKnowledgeFile {
    <#
    .SYNOPSIS
        Upload a knowledge file to an agent.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId,
        [Parameter(Mandatory)][string]$FilePath,
        [string]$Name
    )

    if (-not (Test-Path $FilePath)) {
        throw "File not found: $FilePath"
    }

    $fileName = [System.IO.Path]::GetFileName($FilePath)
    if (-not $Name) { $Name = $fileName }

    # Create knowledge component
    $createHeaders = $Ctx.Headers.Clone()
    $createHeaders['Prefer'] = 'return=representation'

    $knowledgeBody = @{
        componenttype            = 16
        name                     = $Name
        content                  = "{`"sourceType`":`"file`",`"fileName`":`"$fileName`"}"
        "_parentbotid_value"     = $BotId
    } | ConvertTo-Json -Depth 5

    $newComponent = Invoke-RestMethod -Uri "$($Ctx.OrgUrl)/api/data/v9.2/botcomponents" `
        -Method POST -Body $knowledgeBody -Headers $createHeaders -ContentType "application/json"

    $componentId = $newComponent.botcomponentid
    Write-Host "Created knowledge component: $componentId" -ForegroundColor Cyan

    # Upload file content
    $fileBytes = [System.IO.File]::ReadAllBytes($FilePath)
    $uploadHeaders = $Ctx.Headers.Clone()
    $uploadHeaders['Content-Type'] = 'application/octet-stream'
    $uploadHeaders['x-ms-file-name'] = $fileName

    Invoke-RestMethod -Uri "$($Ctx.OrgUrl)/api/data/v9.2/botcomponents($componentId)/content" `
        -Method PATCH -Body $fileBytes -Headers $uploadHeaders

    Write-Host "File uploaded: $fileName ($($fileBytes.Length) bytes)" -ForegroundColor Green
    return $componentId
}

# -----------------------------------------------------------------------------
# Bound Actions
# -----------------------------------------------------------------------------

function Publish-Bot {
    <#
    .SYNOPSIS
        Publish an agent via PvaPublish bound action.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId
    )

    $uri = "$($Ctx.OrgUrl)/api/data/v9.2/bots($BotId)/Microsoft.Dynamics.CRM.PvaPublish"
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $Ctx.Headers `
        -ContentType "application/json" -Body '{}'

    Write-Host "Publish initiated for bot $BotId" -ForegroundColor Green
    return $response
}

function Remove-Bot {
    <#
    .SYNOPSIS
        Delete an agent via PvaDeleteBot bound action.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId
    )

    $uri = "$($Ctx.OrgUrl)/api/data/v9.2/bots($BotId)/Microsoft.Dynamics.CRM.PvaDeleteBot"
    Invoke-RestMethod -Uri $uri -Method POST -Headers $Ctx.Headers `
        -ContentType "application/json" -Body '{}'

    Write-Host "Bot $BotId deleted" -ForegroundColor Yellow
}

function Get-DirectLineToken {
    <#
    .SYNOPSIS
        Get Direct Line token for testing via PvaGetDirectLineEndpoint bound action.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Ctx,
        [Parameter(Mandatory)][string]$BotId
    )

    $uri = "$($Ctx.OrgUrl)/api/data/v9.2/bots($BotId)/Microsoft.Dynamics.CRM.PvaGetDirectLineEndpoint"
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $Ctx.Headers `
        -ContentType "application/json" -Body '{}'

    Write-Host "Direct Line token acquired. Endpoint: $($response.endpointUrl)" -ForegroundColor Green
    return $response
}

# -----------------------------------------------------------------------------
# Convenience: Quick Connect with environment defaults
# -----------------------------------------------------------------------------

function Connect-DataverseFromPac {
    <#
    .SYNOPSIS
        Connect using the active PAC CLI profile's environment URL.
        Gets the org URL from `pac auth list` output.
    #>

    $authOutput = pac auth list 2>&1 | Out-String
    $match = [regex]::Match($authOutput, '\*\s+.*?(https://\S+)')
    if (-not $match.Success) {
        throw "No active PAC auth profile found. Run 'pac auth create' first."
    }

    $orgUrl = $match.Groups[1].Value.TrimEnd('/')
    Write-Host "Using PAC auth environment: $orgUrl" -ForegroundColor Cyan
    return Connect-Dataverse -OrgUrl $orgUrl
}

# -----------------------------------------------------------------------------
# Auto-execute if run directly with parameters
# -----------------------------------------------------------------------------

if ($OrgUrl) {
    if ($ClientId -and $ClientSecret -and $TenantId) {
        $ctx = Connect-Dataverse -OrgUrl $OrgUrl -ClientId $ClientId -ClientSecret $ClientSecret -TenantId $TenantId
    }
    else {
        $ctx = Connect-Dataverse -OrgUrl $OrgUrl
    }
    Write-Host "`nContext ready. Use `$ctx with helper functions." -ForegroundColor Green
}
