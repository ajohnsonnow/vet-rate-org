"""
Test Script: Verify Lumbar Strain Search Fix
=============================================

This script tests that "lumbar strain" now returns DC 5237 correctly.
"""

import json

def search_database(query, data):
    """Simple search function to mimic app search behavior"""
    query_lower = query.lower()
    results = []
    
    disabilities = data.get('disabilities', [])
    
    for entry in disabilities:
        # Check condition name
        if query_lower in entry.get('conditionName', '').lower():
            results.append(entry)
            continue
        
        # Check aliases
        for alias in entry.get('aliases', []):
            if query_lower in alias.lower():
                results.append(entry)
                break
        
        # Check search terms
        if entry not in results:
            for term in entry.get('searchTerms', []):
                if query_lower in term.lower():
                    results.append(entry)
                    break
    
    return results

def test_search(query):
    """Test a search query"""
    print(f"\n{'='*80}")
    print(f"TESTING SEARCH: '{query}'")
    print('='*80)
    
    with open('src/data/disabilityData.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    results = search_database(query, data)
    
    if not results:
        print(f"❌ NO RESULTS FOUND for '{query}'")
        return False
    
    print(f"✅ Found {len(results)} result(s):\n")
    
    for i, result in enumerate(results, 1):
        dc = result.get('diagnosticCode')
        condition = result.get('conditionName')
        aliases = result.get('aliases', [])
        search_terms = result.get('searchTerms', [])
        
        print(f"{i}. DC {dc}: {condition}")
        print(f"   Aliases: {', '.join(aliases[:5])}")
        print(f"   Search Terms: {', '.join([t for t in search_terms if query.lower() in t.lower()][:5])}")
        print()
    
    return True

def main():
    print("="*80)
    print("TESTER FEEDBACK VERIFICATION")
    print("="*80)
    print("\nVerifying fixes for tester-reported search issues:")
    print("-" * 80)
    
    # Test cases based on tester feedback
    tests = [
        ("lumbar strain", "DC 5237", "Original tester issue: 'lumbar strain' returned no results"),
        ("lumbosacral strain", "DC 5237", "Related search term"),
        ("lower back strain", "DC 5237", "Common veteran terminology"),
        ("cervical strain", "DC 5237", "DC 5237 covers cervical too"),
        ("neck strain", "DC 5237", "Common cervical strain search"),
        ("hypothyroidism", "DC 7903", "Should return 7903, NOT 7900"),
        ("hyperthyroidism", "DC 7900", "Should return 7900 after fix"),
        ("Graves disease", "DC 7900", "Graves' is hyperthyroidism"),
    ]
    
    passed = 0
    failed = 0
    
    for query, expected_dc, description in tests:
        print(f"\n📝 Test: {description}")
        print(f"   Query: '{query}' → Expected: {expected_dc}")
        
        with open('src/data/disabilityData.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        results = search_database(query, data)
        
        if not results:
            print(f"   ❌ FAIL: No results found")
            failed += 1
        else:
            # Check if expected DC is in results
            found_dc = any(r.get('diagnosticCode') == expected_dc.split()[1] for r in results)
            if found_dc:
                result = next(r for r in results if r.get('diagnosticCode') == expected_dc.split()[1])
                print(f"   ✅ PASS: Found {expected_dc}: {result.get('conditionName')}")
                passed += 1
            else:
                print(f"   ⚠️  PARTIAL: Found {len(results)} result(s) but not {expected_dc}")
                dc_list = ', '.join([f"DC {r.get('diagnosticCode')}" for r in results[:3]])
                print(f"       Results: {dc_list}")
                failed += 1
    
    print("\n" + "="*80)
    print("TEST RESULTS")
    print("="*80)
    print(f"Passed: {passed}/{len(tests)}")
    print(f"Failed: {failed}/{len(tests)}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Search functionality verified.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Review results above.")
    
    # Detailed check for lumbar strain (original tester issue)
    print("\n" + "="*80)
    print("DETAILED CHECK: 'lumbar strain' (Original Tester Issue)")
    print("="*80)
    test_search("lumbar strain")

if __name__ == "__main__":
    main()
